# Scout — Manual Deployment via Azure Portal

This guide creates the whole stack by hand in the Azure Portal. The **only** step
that can't be done in the portal is building the container images — that's a short
PowerShell snippet using `az acr build` (builds in the cloud, **no local Docker
needed**).

Do the steps in order. Resource names below are suggestions — pick your own where
noted (storage account and ACR names must be globally unique).

> Target shapes: backend = 1 vCPU / 2 GiB, **internal** ingress, scale 0→1.
> frontend = 0.25 vCPU / 0.5 GiB, **public** ingress, scale 0→2.

---

## 1. Resource group
Portal → **Resource groups** → **Create**
- Name: `rg-scout`
- Region: **Central India** (or nearest to your users)
- Create.

## 2. Container Registry
Portal → **Create a resource** → search **Container Registry** → **Create**
- Resource group: `rg-scout`
- Registry name: `scoutacr` (must be globally unique — if taken, pick another and use it everywhere below)
- Location: same region
- SKU: **Basic**
- Create. When done: open the registry → **Settings → Access keys** → toggle **Admin user = Enabled** (lets the portal pull images with a username/password — simplest option; see "More secure alternative" at the end).

## 3. Build & push the images (PowerShell — run once now, and again on every code change)
Open PowerShell. Azure CLI must be installed (`winget install Microsoft.AzureCLI` if not).

```powershell
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"

# Repo root (folder that contains Dockerfile.backend / Dockerfile.frontend)
cd "C:\Users\user\OneDrive - sarral.io\Desktop\scout\sarral-scout"

# Backend (Kali image — first build takes several minutes)
az acr build --registry scoutacr --image scout-backend:v1 --file Dockerfile.backend .

# Frontend (leave the VITE_* args empty unless you're enabling Microsoft SSO)
az acr build --registry scoutacr --image scout-frontend:v1 --file Dockerfile.frontend `
  --build-arg VITE_MICROSOFT_CLIENT_ID="" `
  --build-arg VITE_MICROSOFT_AUTHORITY="" `
  --build-arg VITE_MICROSOFT_REDIRECT_URI="" `
  .
```
Verify in the portal: ACR → **Services → Repositories** shows `scout-backend` and `scout-frontend`.

## 4. Storage account + file shares (for SQLite DB and PDF reports)
Portal → **Create a resource** → **Storage account** → **Create**
- Resource group: `rg-scout`; Name: e.g. `scoutstg<random>` (globally unique, lowercase); Region: same
- Performance: Standard; Redundancy: **LRS**
- Create.

Then open the storage account:
- **Data storage → File shares → + File share**: name `scout-data` (Tier: Transaction optimized) → Create
- **+ File share** again: name `scout-reports` → Create
- **Security + networking → Access keys**: copy the **Storage account name** and **key1** (you'll paste these in step 6).

## 5. Container Apps Environment
Portal → **Create a resource** → search **Container Apps Environment** → **Create**
- Resource group: `rg-scout`; Name: `scout-env`; Region: same
- Plan / Zone redundancy: **Consumption**, zone redundancy **Disabled**
- (A Log Analytics workspace is created automatically.)
- Create.

## 6. Attach Azure Files to the environment
Open **scout-env** → **Settings → Azure Files → Add**
- File share name: `scoutdata`
- Storage account name: *(from step 4)*; Storage account key: *(key1 from step 4)*
- File share: `scout-data`; Access mode: **Read/Write** → Add

Click **Add** again for reports:
- File share name: `scoutreports`; same account/key; File share: `scout-reports`; Access mode **Read/Write** → Add.

## 7. Create the backend container app
Portal → **Create a resource** → **Container App** → **Create**

**Basics**
- Resource group `rg-scout`; Container app name `scout-backend`; Region same; Environment `scout-env`.

**Container**
- Uncheck **Use quickstart image**.
- Image source: **Azure Container Registry**; Registry `scoutacr`; Image `scout-backend`; Tag `v1`.
- CPU and Memory: **1 CPU, 2 Gi**.
- **Environment variables** — Add these (plain text for now; we'll convert `JWT_SECRET` to a secret in step 8):
  - `DATABASE_URL` = `file:/app/data/dev.db`
  - `EXECUTION_MODE` = `local`
  - `ALGORITHM` = `HS256`
  - `ACCESS_TOKEN_EXPIRE_MINUTES` = `1440`
  - `JWT_SECRET` = *(a long random string)*
  - *(optional AI)* `GEMINI_API_KEY` = *(key)* and/or `DATABRICKS_API_KEY`, `DATABRICKS_API_BASE`, `DATABRICKS_MODEL`

**Ingress**
- Ingress: **Enabled**
- Ingress traffic: **Limited to Container Apps Environment** ← this makes it **internal-only**
- Target port: **8000**

Create. (The first revision may take a while to pull the large image.)

## 8. Backend — add volume mounts, secrets, and scale
Open **scout-backend**:

**a) Secrets** → **Settings → Secrets → Add**
- `jwt-secret` = *(same value you used above)*; add `gemini-api-key` / `databricks-api-key` if used. Save.

**b) New revision with volumes** → **Application → Revisions and replicas → Edit and deploy** (or **Create new revision**):
- **Volumes** tab → **Add**: Volume type **Azure Files**, Storage name **scoutdata**, Volume name `data`. Add another: storage **scoutreports**, volume name `reports`.
- **Container** (click the container → edit):
  - **Volume mounts**: mount `data` → `/app/data`; mount `reports` → `/app/reports`.
  - **Environment variables**: change `JWT_SECRET` to **Reference a secret** → `jwt-secret` (do the same for any AI keys you stored as secrets).
- **Scale** tab: **Min replicas = 0**, **Max replicas = 1** (max must stay 1).
- **Create** / **Deploy**.

**c)** Confirm healthy: **Monitoring → Log stream** should show `Starting Scout API…` then uvicorn on `:8000`.

## 9. Copy the backend internal URL
**scout-backend → Overview** (or **Ingress**) → copy the **Application Url**. It looks like:
`https://scout-backend.internal.<env>.<region>.azurecontainerapps.io`

## 10. Create the frontend container app
Portal → **Create a resource** → **Container App** → **Create**

**Basics**: name `scout-frontend`; RG `rg-scout`; Environment `scout-env`.

**Container**
- Azure Container Registry; image `scout-frontend`; tag `v1`.
- CPU / Memory: **0.25 CPU, 0.5 Gi**.
- Environment variable: `BACKEND_URL` = the URL from step 9 (e.g. `https://scout-backend.internal.…azurecontainerapps.io`).

**Ingress**
- Enabled; Ingress traffic: **Accepting traffic from anywhere** (public); Target port: **80**.

Create. Then **Application → Edit and deploy → Scale**: Min 0, Max 2 (optional).

## 11. Test
**scout-frontend → Overview → Application Url** → open in a browser.
- Register a user, log in.
- Start a small scan **against a target you're authorized to test**; watch the live (SSE) output and let it finish (keep the tab open — see notes).
- Download the PDF report.
- In **scout-backend → Revisions**, restart the active revision and confirm your user/history/reports persist (proves the Azure Files mounts).

---

## Updating the app later
Re-run the relevant `az acr build` in step 3 with a **new tag** (e.g. `:v2`), then in
the container app → **Edit and deploy** → change the image tag to `v2` → Deploy.
(Using a new tag forces a new revision so the new image is actually pulled.)

## Operational notes (important)
- **Scale-to-zero & scans:** the backend sleeps when idle. An open scan tab keeps it
  awake, so a scan finishes as long as the browser stays connected. If a tab closes
  mid-scan and it then idles, the scan is lost. If that's a problem, set the backend
  **Min replicas = 1** (always-on, costs more).
- **Backend max replicas must stay 1** — it keeps SSE state in memory, runs scans
  in-process, and uses single-file SQLite.
- **nmap** runs with `-sT -Pn` (already set in code) because ACA can't grant raw
  sockets; SYN scans / OS detection aren't available in-container.
- **Microsoft SSO:** rebuild the frontend image (step 3) with the real
  `VITE_MICROSOFT_*` build args, where `VITE_MICROSOFT_REDIRECT_URI` = the frontend
  URL from step 11, then redeploy.

## More secure alternative to ACR admin user
Instead of enabling the ACR admin user (step 2), you can give each container app a
**system-assigned managed identity** (app → **Settings → Identity → System assigned →
On**), then on the **ACR → Access control (IAM)** grant that identity the **AcrPull**
role, and set the app's registry authentication to **Managed identity**. This avoids
storing a registry password, at the cost of a few extra clicks and a revision restart
after the role is granted.
```
