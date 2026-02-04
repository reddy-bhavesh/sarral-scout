# Scout - Deployment Guide

This guide covers how to run Scout (Sarral-Scan) locally using Docker and how to deploy it to **Azure Container Apps (ACA)**.

## 1. Local Development

Run the full stack (Frontend, Backend, Redis, Database) locally with Docker Compose.

### Prerequisites

- Docker Desktop installed
- Git

### Run Locally

```bash
# 1. Start the stack
docker-compose up --build

# 2. Access the application
# Frontend: http://localhost:3000
# Backend health: http://localhost:8000/health
```

### Configuration

By default, the local setup uses:

- **Database:** SQLite (persisted in volume `db_data`)
- **Execution Mode:** `local` (runs tools inside the backend container)

---

## 2. Azure Container Apps Deployment

We use Azure Container Apps for a scalable, serverless deployment.

### Architecture

- **Frontend App**: Runs Nginx + React. Configured with `BACKEND_URL` at runtime.
- **Backend App**: Runs FastAPI + Security Tools. Mounts Azure Files for database persistence.
- **Storage**: Azure File Share (`scoutdata`) mounted to `/app/data`.

### Automated Deployment Script

The `deploy-aca.sh` script handles everything (Infrastructure provisioning + Deployment).

```bash
# 1. Edit configuration (optional)
# Open deploy-aca.sh and set a unique ACR_NAME if needed.

# 2. Run the script
chmod +x deploy-aca.sh
./deploy-aca.sh
```

**What the script does:**

1. Creates Resource Group (`rg-sarral-scan`)
2. Creates Azure Container Registry (ACR)
3. Builds and Pushes Docker images
4. Creates Azure Container Apps Environment
5. **Sets up Persistence**: Creates Storage Account & File Share
6. Deploys Backend with volume mount
7. Deploys Frontend with `BACKEND_URL` pointing to the Backend

### CI/CD (GitHub Actions)

The repository includes a workflow `.github/workflows/deploy.yml` for automated updates.

**Setup Secrets in GitHub:**

1. `AZURE_CREDENTIALS`: Output of `az ad sp create-for-rbac ...`
2. `ACR_NAME`: Your registry name (e.g., `sarralscoutacr`)
3. `RESOURCE_GROUP`: `rg-sarral-scan`

### Environment Variables & Secrets

**Security Tip:** We never commit `.env` files. Instead, we manage secrets securely.

#### 1. Using the Deployment Script (`deploy-aca.sh`)

The script automatically loads secrets from your local `backend/.env` file.

- Ensure `backend/.env` exists and contains:
  ```env
  JWT_SECRET=...
  GEMINI_API_KEY=...
  MICROSOFT_CLIENT_ID=...
  DATABRICKS_API_KEY=...
  ```

#### 2. Using CI/CD (GitHub Actions)

Since the runner doesn't have your `.env` file, you must add these as **GitHub Secrets**:

1. Go to **Settings** -> **Secrets and variables** -> **Actions**
2. Add the following repository secrets:
   - `AZURE_CREDENTIALS` (JSON output from `az ad sp create-for-rbac ...`)
   - `ACR_NAME`
   - `RESOURCE_GROUP`
   - `JWT_SECRET`
   - `GEMINI_API_KEY`
   - `MICROSOFT_CLIENT_ID` (Used for both Backend and Frontend build)
   - `DATABRICKS_API_KEY`

3. Add the following **Repository Variables**:
   - `VITE_MICROSOFT_AUTHORITY` (e.g., `https://login.microsoftonline.com/organizations`)
   - `DATABRICKS_API_BASE`
   - `DATABRICKS_MODEL`

---

## 3. Manual CLI Deployment (Reference)

If you prefer running commands manually instead of using the script, follow these steps.

### Prerequisites

```bash
# Set your variables
export RESOURCE_GROUP="rg-sarral-scan"
export ACR_NAME="sarralscoutacr"
export BACKEND_APP_NAME="scout-backend"
export FRONTEND_APP_NAME="scout-frontend"

# Login to Azure
az login
az acr login --name $ACR_NAME
```

### 1. Build & Push Images

**Backend:**

```bash
docker build -f Dockerfile.backend -t $ACR_NAME.azurecr.io/scout-backend:latest .
docker push $ACR_NAME.azurecr.io/scout-backend:latest
```

**Frontend:**
_Note: We must pass build args for React environment variables._

```bash
# Load variables from frontend/.env (or set manually)
export $(grep -v '^#' frontend/.env | sed 's/#.*//g' | tr -d '\r' | xargs)

docker build -f Dockerfile.frontend \
  --build-arg VITE_MICROSOFT_CLIENT_ID="$VITE_MICROSOFT_CLIENT_ID" \
  --build-arg VITE_MICROSOFT_AUTHORITY="$VITE_MICROSOFT_AUTHORITY" \
  --build-arg VITE_MICROSOFT_REDIRECT_URI="$VITE_MICROSOFT_REDIRECT_URI" \
  -t $ACR_NAME.azurecr.io/scout-frontend:latest .

docker push $ACR_NAME.azurecr.io/scout-frontend:latest
```

### 2. Deploy (Update) Container Apps

**Setup Credentials:**

```bash
export ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)
```

**Deploy Backend:**

```bash
# Load secrets (careful with quoting!)
export $(grep -v '^#' backend/.env | sed 's/#.*//g' | tr -d '\r' | xargs)

az containerapp update \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/scout-backend:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password "$ACR_PASSWORD" \
  --set-secrets "jwt-secret=$JWT_SECRET" "gemini-api-key=$GEMINI_API_KEY" "databricks-api-key=$DATABRICKS_API_KEY" \
  --set-env-vars EXECUTION_MODE=local \
             DATABASE_URL="file:/app/data/dev.db" \
             JWT_SECRET="secretref:jwt-secret" \
             GEMINI_API_KEY="secretref:gemini-api-key" \
             DATABRICKS_API_KEY="secretref:databricks-api-key" \
             DATABRICKS_API_BASE="$DATABRICKS_API_BASE" \
             DATABRICKS_MODEL="$DATABRICKS_MODEL" \
             MICROSOFT_CLIENT_ID="$MICROSOFT_CLIENT_ID" \
             ENABLE_MICROSOFT_SSO="$ENABLE_MICROSOFT_SSO"
```

**Deploy Frontend:**

```bash
# Get Backend URL first
export BACKEND_URL="https://$(az containerapp show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)"

az containerapp update \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/scout-frontend:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password "$ACR_PASSWORD" \
  --set-env-vars BACKEND_URL="$BACKEND_URL"
```

---

## 3. Troubleshooting

### Frontend cannot connect to Backend

- **Local:** Ensure port `8000` is exposed. Check network tab for requests to `http://localhost:8000`.
- **Azure:** Check the Frontend logs. Ensure `BACKEND_URL` env var is set correctly to the HTTPS URL of the Backend Container App.

### Database Persistence

- **Local:** Data is in the named volume `db_data`. `docker-compose down -v` will delete it.
- **Azure:** Data is in the Azure File Share `scoutdata`. You can browse/backup this via Azure Portal -> Storage Account -> File Shares.

### Build Issues

- if `npm ci` fails: Check `Dockerfile.frontend` uses `--legacy-peer-deps`.
- if backend tools fail: Ensure the container has outbound internet access.
