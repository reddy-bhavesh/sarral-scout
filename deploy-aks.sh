#!/bin/bash
# =============================================================================
# Scout - AKS Deployment Script
# =============================================================================
# Prerequisites:
# - Azure CLI installed and logged in (az login)
# - kubectl installed
# - Docker installed
# =============================================================================

set -e

# Configuration - UPDATE THESE VALUES
RESOURCE_GROUP="scout-rg"
LOCATION="centralindia"
AKS_CLUSTER_NAME="scout-aks"
ACR_NAME="scoutacr"  # Must be globally unique, lowercase, alphanumeric only

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Scout AKS Deployment ===${NC}"

# Step 1: Create Resource Group
echo -e "${YELLOW}Creating Resource Group...${NC}"
az group create --name $RESOURCE_GROUP --location $LOCATION

# Step 2: Create Azure Container Registry
echo -e "${YELLOW}Creating Azure Container Registry...${NC}"
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic

# Step 3: Create AKS Cluster
echo -e "${YELLOW}Creating AKS Cluster (this may take several minutes)...${NC}"
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --node-count 2 \
  --node-vm-size Standard_D4s_v3 \
  --enable-managed-identity \
  --attach-acr $ACR_NAME \
  --generate-ssh-keys

# Step 4: Get AKS credentials
echo -e "${YELLOW}Getting AKS credentials...${NC}"
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_CLUSTER_NAME --overwrite-existing

# Step 5: Login to ACR
echo -e "${YELLOW}Logging into ACR...${NC}"
az acr login --name $ACR_NAME

# Step 6: Build and push Docker images
echo -e "${YELLOW}Building and pushing Docker images...${NC}"

# Backend
echo "Building backend image..."
docker build -f Dockerfile.backend -t $ACR_NAME.azurecr.io/scout-backend:latest .
docker push $ACR_NAME.azurecr.io/scout-backend:latest

# Frontend
echo "Building frontend image..."
docker build -f Dockerfile.frontend -t $ACR_NAME.azurecr.io/scout-frontend:latest .
docker push $ACR_NAME.azurecr.io/scout-frontend:latest

# Step 7: Update Kubernetes manifests with ACR name
echo -e "${YELLOW}Updating Kubernetes manifests...${NC}"
sed -i "s/\${ACR_NAME}/$ACR_NAME/g" k8s/02-backend.yaml
sed -i "s/\${ACR_NAME}/$ACR_NAME/g" k8s/03-frontend.yaml

# Step 8: Install NGINX Ingress Controller
echo -e "${YELLOW}Installing NGINX Ingress Controller...${NC}"
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# Wait for ingress controller to be ready
echo "Waiting for Ingress Controller..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# Step 9: Deploy application
echo -e "${YELLOW}Deploying Scout to AKS...${NC}"
kubectl apply -f k8s/01-config.yaml
kubectl apply -f k8s/02-backend.yaml
kubectl apply -f k8s/03-frontend.yaml
kubectl apply -f k8s/04-ingress.yaml

# Step 10: Wait for deployments
echo -e "${YELLOW}Waiting for deployments to be ready...${NC}"
kubectl rollout status deployment/scout-backend -n scout --timeout=300s
kubectl rollout status deployment/scout-frontend -n scout --timeout=120s

# Step 11: Get External IP
echo -e "${YELLOW}Getting External IP...${NC}"
sleep 30  # Wait for LoadBalancer IP allocation
EXTERNAL_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo -e "External IP: ${GREEN}$EXTERNAL_IP${NC}"
echo -e ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Update DNS to point your domain to: $EXTERNAL_IP"
echo -e "2. Update k8s/04-ingress.yaml with your actual domain"
echo -e "3. Apply the updated ingress: kubectl apply -f k8s/04-ingress.yaml"
echo -e "4. (Optional) Configure TLS with cert-manager for HTTPS"
echo -e ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo -e "  View pods:     kubectl get pods -n scout"
echo -e "  View logs:     kubectl logs -f deployment/scout-backend -n scout"
echo -e "  Get services:  kubectl get svc -n scout"
