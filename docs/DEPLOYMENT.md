# Scout — Azure Deployment Guide

Cost-optimized deployment of Scout on **Azure Container Apps (ACA)**, built from
GitHub. This replaces the old `deploy-aca.sh` / `deploy-*.yml` glue.

## Architecture

```
Internet ──HTTPS──▶ scout-frontend (nginx + React)   public ingress, scale 0→2
                          │  proxies /api,/auth,/scans,/events,… same-origin
                          ▼
                    scout-backend (FastAPI + Kali tools)   INTERNAL ingress, scale 0→1
                          ├─ Azure Files  → /app/data     (SQLite dev.db)
                          └─ Azure Files  → /app/reports   (generated PDFs)

  Both apps pull from ACR via a user-assigned managed identity (no passwords).
  App secrets live in the ACA secret store.
```

The **backend is internal-only** — it has no public FQDN and is reachable solely
by the frontend inside the ACA environment.

| Resource | Name (default) | Notes |
|---|---|---|
| Resource group | `rg-scout` | |
| Container registry | `scoutacr` (Basic) | ~$5/mo |
| Storage + Azure Files | auto `scoutstg…` | shares `scout-data`, `scout-reports`; ~$1–3/mo |
| Log Analytics | `log-scout` | 30-day retention |
| ACA environment | `scout-env` | Consumption |
| Backend app | `scout-backend` | 1 vCPU / 2 GiB, min 0 / **max 1** |
| Frontend app | `scout-frontend` | 0.25 vCPU / 0.5 GiB, min 0 / max 2 |

**Rough cost (low traffic):** ~$6–25/mo (ACA compute is mostly inside the free
monthly grant when idle).

## Files

- `infra/main.bicep` — the full stack (IaC).
- `infra/main.bicepparam` — parameters, read from environment variables.
- `infra/bootstrap.sh` — one-time setup (RG, ACR, GitHub OIDC).
- `.github/workflows/deploy.yml` — CI/CD (cloud image build + Bicep deploy).

## First-time setup

1. **Bootstrap** (run once, locally, with `az login` done):

   ```bash
   GITHUB_REPO="your-org/scout" ./infra/bootstrap.sh
   ```

   This creates the resource group, ACR, and a GitHub OIDC identity, then prints
   the GitHub secrets/variables to set.

2. **Add the printed secrets/variables** in GitHub → Settings → Secrets and
   variables → Actions:
   - Required secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
     `AZURE_SUBSCRIPTION_ID`, `JWT_SECRET`.
   - Optional secrets: `GEMINI_API_KEY`, `DATABRICKS_API_KEY`,
     `DATABRICKS_API_BASE`.
   - Optional variables: `BACKEND_MIN_REPLICAS` (0/1), `ENABLE_MICROSOFT_SSO`,
     `MICROSOFT_TENANT_ID`, `DATABRICKS_MODEL`, and the `VITE_MICROSOFT_*` build
     args.

3. **First deploy:** run the **Deploy to Azure** workflow manually
   (`workflow_dispatch`) with **`force_all = true`** so both images build. The
   frontend URL is printed in the run summary.

4. **(If using Microsoft SSO)** set the GitHub variable
   `VITE_MICROSOFT_REDIRECT_URI` to the printed frontend URL and re-run the
   workflow (it is baked into the frontend build).

After this, every push to `main` that touches `backend/`, `frontend/`,
`infra/`, or the Dockerfiles redeploys automatically (only the changed image
rebuilds).

## Important operational notes

### Scale-to-zero and in-progress scans
The backend scales to zero when idle (cheapest). An **open SSE stream keeps it
warm**, so a scan finishes as long as the user's browser tab stays connected. If
the tab closes mid-scan and the app then idles past the cooldown (~5 min
default), the in-progress scan is lost. If this is a problem, set the
`BACKEND_MIN_REPLICAS` GitHub variable to `1` (always-on, ~$30–45/mo) and re-run
the workflow.

### Single backend replica (do not change)
`maxReplicas` is fixed at **1**. The backend keeps SSE queues in memory, runs
scans as in-process asyncio tasks, and writes SQLite as a single file. More than
one replica would split user sessions and corrupt the database.

### nmap in ACA
ACA cannot grant `NET_RAW`/`NET_ADMIN`, so the nmap commands in
`backend/app/core/tool_config.py` use `-sT -Pn` (TCP-connect, no raw-socket host
discovery). SYN scans / OS detection are unavailable in-container. For full nmap
capability, run a separate Kali host and set `EXECUTION_MODE=ssh` with the
`KALI_*` settings.

### Image size / cold start
The backend image is Kali-based (~2–3 GB), so the first request after idle is
slow. To speed cold starts you can drop the ~500 MB SecLists clone from
`Dockerfile.backend` (the FFUF tool only uses the small dirb `common.txt`).

### Authorization / compliance
Running active scanners outbound from Azure against your own assets is fine.
Scanning third-party targets without authorization can violate the Azure Online
Services Terms — only scan systems you are authorized to test.

## Verifying a deployment

```bash
# Frontend URL (open in a browser; confirm TLS + SPA loads)
az containerapp show -n scout-frontend -g rg-scout \
  --query properties.configuration.ingress.fqdn -o tsv

# Backend should be internal (no public FQDN)
az containerapp show -n scout-backend -g rg-scout \
  --query properties.configuration.ingress -o json

# Watch backend logs / replicas
az containerapp logs show -n scout-backend -g rg-scout --follow
az containerapp replica list -n scout-backend -g rg-scout -o table
```

End-to-end: register a user → start a small scan against an authorized target →
confirm live SSE output and completion → download the PDF report → restart the
revision and confirm history/reports persist (proves the Azure Files mounts).
```bash
az containerapp revision restart -n scout-backend -g rg-scout \
  --revision "$(az containerapp show -n scout-backend -g rg-scout --query properties.latestRevisionName -o tsv)"
```
```
