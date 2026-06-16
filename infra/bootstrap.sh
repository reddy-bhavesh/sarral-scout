#!/usr/bin/env bash
#
# One-time bootstrap for the Scout Azure deployment (run from a clean subscription).
# Creates: resource group, ACR (Basic), and a GitHub OIDC app registration with
# a federated credential + Contributor on the resource group. After this, all
# ongoing deploys happen through .github/workflows/deploy.yml — no secrets stored.
#
# Prereqs: az CLI logged in (`az login`), Owner/Contributor + permission to create
# Entra app registrations on the target tenant.
#
# Usage:
#   GITHUB_REPO="your-org/scout" ./infra/bootstrap.sh
#
set -euo pipefail

# ---- Config (override via environment) -------------------------------------
SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-scout}"
LOCATION="${LOCATION:-centralindia}"
ACR_NAME="${ACR_NAME:-scoutacr}"          # must be globally unique, 5-50 alphanumerics
APP_NAME="${APP_NAME:-scout-github-oidc}"
GITHUB_REPO="${GITHUB_REPO:?Set GITHUB_REPO=owner/repo}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

echo "Subscription : $SUBSCRIPTION_ID"
echo "Resource grp : $RESOURCE_GROUP ($LOCATION)"
echo "ACR          : $ACR_NAME"
echo "GitHub repo  : $GITHUB_REPO (branch $GITHUB_BRANCH)"
echo

az account set --subscription "$SUBSCRIPTION_ID"

# ---- Resource providers -----------------------------------------------------
echo ">> Registering resource providers..."
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry Microsoft.Storage Microsoft.ManagedIdentity; do
  az provider register --namespace "$ns" --wait
done

# ---- Resource group + ACR ---------------------------------------------------
echo ">> Creating resource group + ACR..."
az group create -n "$RESOURCE_GROUP" -l "$LOCATION" -o none
az acr create -n "$ACR_NAME" -g "$RESOURCE_GROUP" --sku Basic --admin-enabled false -o none

# ---- GitHub OIDC app registration ------------------------------------------
echo ">> Creating Entra app registration for GitHub OIDC..."
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
az ad sp create --id "$APP_ID" -o none 2>/dev/null || true
TENANT_ID=$(az account show --query tenantId -o tsv)

echo ">> Adding federated credentials (branch push + workflow_dispatch)..."
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-${GITHUB_BRANCH}\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GITHUB_REPO}:ref:refs/heads/${GITHUB_BRANCH}\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}" -o none

echo ">> Granting Contributor on the resource group..."
az role assignment create \
  --assignee "$APP_ID" \
  --role Contributor \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}" -o none

# ---- Output -----------------------------------------------------------------
SUGGESTED_JWT=$(openssl rand -hex 32 2>/dev/null || echo "<run: openssl rand -hex 32>")

cat <<EOF

============================================================================
 Bootstrap complete. Add these to GitHub -> Settings -> Secrets and variables
 -> Actions.

 Repository SECRETS (required):
   AZURE_CLIENT_ID        = ${APP_ID}
   AZURE_TENANT_ID        = ${TENANT_ID}
   AZURE_SUBSCRIPTION_ID  = ${SUBSCRIPTION_ID}
   JWT_SECRET             = ${SUGGESTED_JWT}

 Repository SECRETS (optional — AI / integrations):
   GEMINI_API_KEY, DATABRICKS_API_KEY, DATABRICKS_API_BASE

 Repository VARIABLES (optional):
   BACKEND_MIN_REPLICAS   = 0           (set 1 for always-on)
   ENABLE_MICROSOFT_SSO   = false
   MICROSOFT_TENANT_ID    = organizations
   VITE_MICROSOFT_CLIENT_ID, VITE_MICROSOFT_AUTHORITY, VITE_MICROSOFT_REDIRECT_URI

 NOTE: if you changed ACR_NAME/RESOURCE_GROUP/NAME_PREFIX/LOCATION here, update
 the matching 'env:' values in .github/workflows/deploy.yml.

 First deploy: run the "Deploy to Azure" workflow with force_all = true.
 The frontend URL is printed in the workflow summary; for Microsoft SSO set
 VITE_MICROSOFT_REDIRECT_URI to that URL and re-run.
============================================================================
EOF
