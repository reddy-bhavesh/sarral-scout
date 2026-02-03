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
STORAGE_ACCOUNT_NAME="sarralscoutstorage"
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

# Ensure Admin User is enabled (required for ACA to pull images using keys)
echo -e "${YELLOW}Enabling ACR Admin User...${NC}"
az acr update --name $ACR_NAME --resource-group $RESOURCE_GROUP --admin-enabled true

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
    export $(grep -v '^#' frontend/.env | sed 's/#.*//g' | tr -d '\r' | xargs)
fi

docker build -f Dockerfile.frontend \
  --build-arg VITE_MICROSOFT_CLIENT_ID="$VITE_MICROSOFT_CLIENT_ID" \
  --build-arg VITE_MICROSOFT_AUTHORITY="$VITE_MICROSOFT_AUTHORITY" \
  --build-arg VITE_MICROSOFT_REDIRECT_URI="$VITE_MICROSOFT_REDIRECT_URI" \
  -t $ACR_NAME.azurecr.io/scout-frontend:latest .

docker push $ACR_NAME.azurecr.io/scout-frontend:latest

# 3. Create Container App Environment
# 3. Create Container App Environment
echo -e "${YELLOW}Creating Container Apps Environment...${NC}"

if ! az containerapp env show --name $ENVIRONMENT_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    az containerapp env create \
      --name $ENVIRONMENT_NAME \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION
else
    echo "Environment $ENVIRONMENT_NAME already exists"
fi

# 4. Setup Persistence (Azure Files)
echo -e "${YELLOW}Setting up Storage...${NC}"
# Create Storage Account
if ! az storage account show --name $STORAGE_ACCOUNT_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    az storage account create \
      --name $STORAGE_ACCOUNT_NAME \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION \
      --sku Standard_LRS \
      --kind StorageV2
else
    echo "Storage Account $STORAGE_ACCOUNT_NAME already exists"
fi

# Get Key
STORAGE_KEY=$(az storage account keys list --resource-group $RESOURCE_GROUP --account-name $STORAGE_ACCOUNT_NAME --query "[0].value" -o tsv)

# Create File Share
if ! az storage share-rm show --storage-account $STORAGE_ACCOUNT_NAME --name $FILE_SHARE_NAME &>/dev/null; then
    az storage share-rm create \
      --resource-group $RESOURCE_GROUP \
      --storage-account $STORAGE_ACCOUNT_NAME \
      --name $FILE_SHARE_NAME \
      --quota 5
else
    echo "File Share $FILE_SHARE_NAME already exists"
fi

# Mount Storage to Environment
# Only mount if not already mounted
echo "Checking storage configuration..."
# Check if storage is already mounted by listing storages in the environment
EXISTING_STORAGE=$(az containerapp env storage list --resource-group $RESOURCE_GROUP --name $ENVIRONMENT_NAME --query "[?name=='$FILE_SHARE_NAME'].name" -o tsv)

if [ -z "$EXISTING_STORAGE" ]; then
    echo "Mounting storage to ACA Environment..."
    az containerapp env storage set \
      --name $ENVIRONMENT_NAME \
      --resource-group $RESOURCE_GROUP \
      --storage-name $FILE_SHARE_NAME \
      --azure-file-account-name $STORAGE_ACCOUNT_NAME \
      --azure-file-account-key $STORAGE_KEY \
      --azure-file-share-name $FILE_SHARE_NAME \
      --access-mode ReadWrite
else
    echo "Storage $FILE_SHARE_NAME is already mounted. Skipping."
fi

# Load Environment Variables from backend/.env
if [ -f backend/.env ]; then
    echo -e "${YELLOW}Loading secrets from backend/.env...${NC}"
    export $(grep -v '^#' backend/.env | sed 's/#.*//g' | tr -d '\r' | xargs)
else
    echo -e "${RED}Error: backend/.env not found! Cannot deploy without secrets.${NC}"
    exit 1
fi

# 5. Deploy Backend
echo -e "${YELLOW}Deploying Backend...${NC}"
echo "Retrieving ACR credentials..."
# Add retry logic for ACR credentials
MAX_RETRIES=5
RETRY_COUNT=0
ACR_PASSWORD=""

while [ -z "$ACR_PASSWORD" ] && [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv 2>/dev/null)
    if [ -z "$ACR_PASSWORD" ]; then
        echo "Waiting for ACR Admin user to propagate... ($((RETRY_COUNT+1))/$MAX_RETRIES)"
        sleep 5
        RETRY_COUNT=$((RETRY_COUNT+1))
    fi
done

if [ -z "$ACR_PASSWORD" ]; then
    echo -e "${RED}Error: Could not retrieve ACR password. Ensure Admin user is enabled on $ACR_NAME${NC}"
    exit 1
fi
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
  --registry-password "$ACR_PASSWORD" \
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
  --registry-password "$ACR_PASSWORD" \
  --env-vars BACKEND_URL="https://$BACKEND_URL"

# Get Frontend URL
FRONTEND_URL=$(az containerapp show --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)

echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo -e "Frontend: https://$FRONTEND_URL"
echo -e "Backend: https://$BACKEND_URL"
echo -e ""
echo -e "NOTE: The Frontend is configured to proxy API requests to the Backend automatically."
