#!/bin/bash
# =============================================================================
# Scout - Azure Container Apps Deployment Script
# =============================================================================

set -e

# Configuration
RESOURCE_GROUP="rg-sarral-scan"
LOCATION="centralindia"
ACR_NAME="sarralscoutacr" # Using random suffix to ensure uniqueness
ENVIRONMENT_NAME="scout-env"
BACKEND_APP_NAME="scout-backend"
FRONTEND_APP_NAME="scout-frontend"
STORAGE_ACCOUNT_NAME="scoutstorage"
FILE_SHARE_NAME="scoutdata"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Scout Azure Container Apps Deployment ===${NC}"

# 1. Create ACR
echo -e "${YELLOW}Creating ACR...${NC}"
# Check if ACR exists, if not create
if ! az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true
else
    echo "ACR $ACR_NAME already exists"
fi

# 2. Build & Push Images
echo -e "${YELLOW}Building & Pushing Images...${NC}"
az acr login --name $ACR_NAME

# Backend
echo "Building Backend..."
docker build -f Dockerfile.backend -t $ACR_NAME.azurecr.io/scout-backend:latest .
docker push $ACR_NAME.azurecr.io/scout-backend:latest

# Frontend
echo "Building Frontend..."
# Load Frontend Env Vars
if [ -f frontend/.env ]; then
    echo "Loading frontend variables..."
    export $(grep -v '^#' frontend/.env | tr -d '\r' | xargs)
fi

docker build -f Dockerfile.frontend \
  --build-arg VITE_MICROSOFT_CLIENT_ID="$VITE_MICROSOFT_CLIENT_ID" \
  --build-arg VITE_MICROSOFT_AUTHORITY="$VITE_MICROSOFT_AUTHORITY" \
  --build-arg VITE_MICROSOFT_REDIRECT_URI="$VITE_MICROSOFT_REDIRECT_URI" \
  -t $ACR_NAME.azurecr.io/scout-frontend:latest .

docker push $ACR_NAME.azurecr.io/scout-frontend:latest

# 3. Create Container App Environment
echo -e "${YELLOW}Creating Container Apps Environment...${NC}"
az containerapp env create \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# 4. Setup Persistence (Azure Files)
echo -e "${YELLOW}Setting up Storage...${NC}"
# Create Storage Account
az storage account create \
  --name $STORAGE_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Get Key
STORAGE_KEY=$(az storage account keys list --resource-group $RESOURCE_GROUP --account-name $STORAGE_ACCOUNT_NAME --query "[0].value" -o tsv)

# Create File Share
az storage share-rm create \
  --resource-group $RESOURCE_GROUP \
  --storage-account $STORAGE_ACCOUNT_NAME \
  --name $FILE_SHARE_NAME \
  --quota 5

# Mount Storage to Environment
echo "Mounting storage to ACA Environment..."
az containerapp env storage set \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --storage-name $FILE_SHARE_NAME \
  --azure-file-account-name $STORAGE_ACCOUNT_NAME \
  --azure-file-account-key $STORAGE_KEY \
  --azure-file-share-name $FILE_SHARE_NAME \
  --access-mode ReadWrite

# Load Environment Variables from backend/.env
if [ -f backend/.env ]; then
    echo -e "${YELLOW}Loading secrets from backend/.env...${NC}"
    # Export variables, handling comments and Windows line endings
    # We use 'sed' to filter out empty lines and comments, then export
    export $(grep -v '^#' backend/.env | tr -d '\r' | xargs)
else
    echo -e "${RED}Error: backend/.env not found! Cannot deploy without secrets.${NC}"
    exit 1
fi

# 5. Deploy Backend
echo -e "${YELLOW}Deploying Backend...${NC}"
az containerapp create \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/scout-backend:latest \
  --target-port 8000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 1 \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password $(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv) \
  --secrets "jwt-secret=$JWT_SECRET" "gemini-api-key=$GEMINI_API_KEY" "databricks-api-key=$DATABRICKS_API_KEY" \
  --env-vars EXECUTION_MODE=local \
             DATABASE_URL="file:/app/data/dev.db" \
             JWT_SECRET="secretref:jwt-secret" \
             GEMINI_API_KEY="secretref:gemini-api-key" \
             DATABRICKS_API_KEY="secretref:databricks-api-key" \
             DATABRICKS_API_BASE="$DATABRICKS_API_BASE" \
             DATABRICKS_MODEL="$DATABRICKS_MODEL" \
             MICROSOFT_CLIENT_ID="$MICROSOFT_CLIENT_ID" \
             ENABLE_MICROSOFT_SSO="$ENABLE_MICROSOFT_SSO" \
  --mounts "volume=/$FILE_SHARE_NAME,mountPath=/app/data"

# Get Backend URL
BACKEND_URL=$(az containerapp show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
echo "Backend URL: https://$BACKEND_URL"

# 6. Deploy Frontend
echo -e "${YELLOW}Deploying Frontend...${NC}"
# Note: In ACA, frontend needs to talk to backend via public URL since they are separate apps (unless using Dapr/internal ingress)
# We'll use the public URL for now.
# However, React app runs in browser, so it needs public URL regardless.

az containerapp create \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/scout-frontend:latest \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 1 \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password $(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv) \
  --env-vars BACKEND_URL="https://$BACKEND_URL"

# Get Frontend URL
FRONTEND_URL=$(az containerapp show --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)

echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo -e "Frontend: https://$FRONTEND_URL"
echo -e "Backend: https://$BACKEND_URL"
echo -e ""
echo -e "NOTE: The Frontend is configured to proxy API requests to the Backend automatically."
