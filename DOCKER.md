# Docker & Kubernetes Deployment Guide

This guide covers containerizing and deploying Scout to Azure Kubernetes Service (AKS).

## Quick Start (Local Docker)

```bash
# Build and run locally
docker-compose up --build

# Access the app
# Frontend: http://localhost
# Backend:  http://localhost:8000
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Kubernetes Service                  │
│  ┌─────────────────┐         ┌──────────────────────────┐  │
│  │    Frontend     │◄───────►│        Backend           │  │
│  │ (Nginx + React) │         │ (FastAPI + Kali Tools)   │  │
│  │   2 replicas    │         │      1 replica           │  │
│  └─────────────────┘         └──────────────────────────┘  │
│           ▲                              │                  │
│           │                              ▼                  │
│  ┌────────────────┐          ┌─────────────────────────┐   │
│  │ Nginx Ingress  │          │   Persistent Volumes    │   │
│  │ LoadBalancer   │          │  (SQLite DB + Reports)  │   │
│  └────────────────┘          └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Files Overview

| File                  | Purpose                              |
| --------------------- | ------------------------------------ |
| `Dockerfile.frontend` | Multi-stage build for React frontend |
| `Dockerfile.backend`  | Kali-based image with security tools |
| `docker-compose.yml`  | Local development setup              |
| `nginx.conf`          | Nginx config with API proxy          |
| `k8s/*.yaml`          | Kubernetes manifests                 |
| `deploy-aks.sh`       | Automated AKS deployment script      |

## Tool Versions

| Tool        | Version      |
| ----------- | ------------ |
| Go          | 1.21.6       |
| Subfinder   | v2.6.0       |
| Amass       | v3.23.3      |
| Nuclei      | v3.4.10      |
| FFUF        | v2.1.0       |
| Dalfox      | v2.12.0      |
| Assetfinder | latest       |
| WhatWeb     | latest (git) |

## AKS Deployment

### Prerequisites

1. Azure CLI installed and logged in
2. Docker installed
3. kubectl installed

### Option 1: Automated Deployment

```bash
# Edit configuration values in deploy-aks.sh first
chmod +x deploy-aks.sh
./deploy-aks.sh
```

### Option 2: Manual Deployment

1. **Create Azure Resources**

```bash
RESOURCE_GROUP="scout-rg"
ACR_NAME="scoutacr"
AKS_NAME="scout-aks"

az group create --name $RESOURCE_GROUP --location centralindia
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic
az aks create --resource-group $RESOURCE_GROUP --name $AKS_NAME \
  --node-count 2 --attach-acr $ACR_NAME --generate-ssh-keys
```

2. **Build and Push Images**

```bash
az acr login --name $ACR_NAME
docker build -f Dockerfile.backend -t $ACR_NAME.azurecr.io/scout-backend:latest .
docker build -f Dockerfile.frontend -t $ACR_NAME.azurecr.io/scout-frontend:latest .
docker push $ACR_NAME.azurecr.io/scout-backend:latest
docker push $ACR_NAME.azurecr.io/scout-frontend:latest
```

3. **Deploy to AKS**

```bash
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_NAME
# Update ${ACR_NAME} in k8s/*.yaml files
kubectl apply -f k8s/
```

## Configuration

### Environment Variables

| Variable         | Description                                | Default                 |
| ---------------- | ------------------------------------------ | ----------------------- |
| `EXECUTION_MODE` | `local` (container) or `ssh` (remote Kali) | `local`                 |
| `JWT_SECRET`     | JWT signing key                            | Required                |
| `GEMINI_API_KEY` | Google Gemini API key                      | Optional                |
| `DATABASE_URL`   | SQLite database path                       | `file:/app/data/dev.db` |

### Updating Secrets

```bash
kubectl create secret generic scout-secrets -n scout \
  --from-literal=JWT_SECRET='your-secret' \
  --from-literal=GEMINI_API_KEY='your-key' \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Troubleshooting

```bash
# View pod status
kubectl get pods -n scout

# View backend logs
kubectl logs -f deployment/scout-backend -n scout

# Shell into backend container
kubectl exec -it deployment/scout-backend -n scout -- /bin/bash

# Test tools inside container
kubectl exec -it deployment/scout-backend -n scout -- nmap --version
kubectl exec -it deployment/scout-backend -n scout -- nuclei --version
```
