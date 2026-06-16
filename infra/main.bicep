// ============================================================================
// Scout — Azure Container Apps deployment (cost-optimized, from scratch)
// ----------------------------------------------------------------------------
// Provisions: storage + Azure Files, Log Analytics, Container Apps environment,
// backend (internal ingress, scale-to-zero, single replica) and frontend
// (public nginx) container apps, plus a user-assigned identity with AcrPull.
//
// The ACR and resource group are created once by infra/bootstrap.sh BEFORE the
// first image build; this template references the ACR as an existing resource.
// ============================================================================

targetScope = 'resourceGroup'

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------
@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Lowercase prefix for resource names (also used for the storage account, so 3-11 lowercase alphanumerics).')
@minLength(3)
@maxLength(11)
param namePrefix string = 'scout'

@description('Name of the EXISTING Azure Container Registry (created by bootstrap.sh).')
param acrName string

@description('Fully-qualified backend image, e.g. scoutacr.azurecr.io/scout-backend:<sha>.')
param backendImage string

@description('Fully-qualified frontend image, e.g. scoutacr.azurecr.io/scout-frontend:<sha>.')
param frontendImage string

@description('Backend minimum replicas. 0 = scale-to-zero (cheapest). Set to 1 for always-on.')
@minValue(0)
@maxValue(1)
param backendMinReplicas int = 0

@description('Backend CPU cores (memory is fixed at 2x in Gi for the supported combo).')
param backendCpu string = '1.0'

@description('Backend memory.')
param backendMemory string = '2Gi'

// --- Application secrets (passed from GitHub Actions; optional ones default to empty) ---
@secure()
@description('JWT signing secret. REQUIRED — do not leave empty in production.')
param jwtSecret string

@secure()
param geminiApiKey string = ''

@secure()
param databricksApiKey string = ''

param databricksApiBase string = ''
param databricksModel string = 'databricks-gemini-3-pro'

param microsoftClientId string = ''
param microsoftTenantId string = 'organizations'
param enableMicrosoftSso bool = false

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------
var storageAccountName = toLower('${namePrefix}stg${uniqueString(resourceGroup().id)}')
var dataShareName = 'scout-data'
var reportsShareName = 'scout-reports'
var dataStorageName = 'scoutdata'      // env storage definition name
var reportsStorageName = 'scoutreports'
var acrPullRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')

// ---------------------------------------------------------------------------
// Existing ACR (created by bootstrap.sh before the first image build)
// ---------------------------------------------------------------------------
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

// ---------------------------------------------------------------------------
// User-assigned managed identity (shared) — used to pull images from ACR
// ---------------------------------------------------------------------------
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${namePrefix}'
  location: location
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, uami.id, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: acrPullRoleId
    principalId: uami.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------------------
// Storage account + Azure Files shares (SQLite DB + generated PDF reports)
// ---------------------------------------------------------------------------
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    largeFileSharesState: 'Enabled'
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource dataShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  parent: fileService
  name: dataShareName
  properties: {
    accessTier: 'TransactionOptimized'
    shareQuota: 10
  }
}

resource reportsShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  parent: fileService
  name: reportsShareName
  properties: {
    accessTier: 'TransactionOptimized'
    shareQuota: 50
  }
}

// ---------------------------------------------------------------------------
// Log Analytics + Container Apps managed environment (Consumption)
// ---------------------------------------------------------------------------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${namePrefix}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Azure Files mounted into the environment (one definition per share)
resource dataStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: env
  name: dataStorageName
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: storage.listKeys().keys[0].value
      shareName: dataShareName
      accessMode: 'ReadWrite'
    }
  }
}

resource reportsStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: env
  name: reportsStorageName
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: storage.listKeys().keys[0].value
      shareName: reportsShareName
      accessMode: 'ReadWrite'
    }
  }
}

// ---------------------------------------------------------------------------
// Backend container app (FastAPI + Kali tools) — INTERNAL ingress only
// ---------------------------------------------------------------------------
var backendSecrets = concat(
  [
    { name: 'jwt-secret', value: jwtSecret }
  ],
  empty(geminiApiKey) ? [] : [ { name: 'gemini-api-key', value: geminiApiKey } ],
  empty(databricksApiKey) ? [] : [ { name: 'databricks-api-key', value: databricksApiKey } ]
)

var backendEnv = concat(
  [
    { name: 'DATABASE_URL', value: 'file:/app/data/dev.db' }
    { name: 'EXECUTION_MODE', value: 'local' }
    { name: 'ALGORITHM', value: 'HS256' }
    { name: 'ACCESS_TOKEN_EXPIRE_MINUTES', value: '1440' }
    { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
    { name: 'ENABLE_MICROSOFT_SSO', value: string(enableMicrosoftSso) }
    { name: 'MICROSOFT_TENANT_ID', value: microsoftTenantId }
  ],
  empty(geminiApiKey) ? [] : [ { name: 'GEMINI_API_KEY', secretRef: 'gemini-api-key' } ],
  empty(databricksApiKey) ? [] : [ { name: 'DATABRICKS_API_KEY', secretRef: 'databricks-api-key' } ],
  empty(databricksApiBase) ? [] : [ { name: 'DATABRICKS_API_BASE', value: databricksApiBase } ],
  empty(databricksModel) ? [] : [ { name: 'DATABRICKS_MODEL', value: databricksModel } ],
  empty(microsoftClientId) ? [] : [ { name: 'MICROSOFT_CLIENT_ID', value: microsoftClientId } ]
)

resource backend 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-backend'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${uami.id}': {}
    }
  }
  dependsOn: [
    acrPull
  ]
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false        // internal only — reachable solely by the frontend within the env
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: uami.id
        }
      ]
      secrets: backendSecrets
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          resources: {
            cpu: json(backendCpu)
            memory: backendMemory
          }
          env: backendEnv
          volumeMounts: [
            { volumeName: 'data', mountPath: '/app/data' }
            { volumeName: 'reports', mountPath: '/app/reports' }
          ]
          // Readiness only — NO liveness probe: long scans can briefly block the
          // event loop, and a failing liveness probe would restart mid-scan.
          probes: [
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 8000
              }
              initialDelaySeconds: 10
              periodSeconds: 10
              failureThreshold: 30
            }
          ]
        }
      ]
      volumes: [
        { name: 'data', storageType: 'AzureFile', storageName: dataStorageName }
        { name: 'reports', storageType: 'AzureFile', storageName: reportsStorageName }
      ]
      scale: {
        minReplicas: backendMinReplicas
        maxReplicas: 1          // MUST stay 1: in-memory SSE, in-process scans, single-writer SQLite
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Frontend container app (nginx + React SPA) — PUBLIC ingress
// ---------------------------------------------------------------------------
resource frontend 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-frontend'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${uami.id}': {}
    }
  }
  dependsOn: [
    acrPull
  ]
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: uami.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: frontendImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'BACKEND_URL'
              value: 'https://${backend.properties.configuration.ingress.fqdn}'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
output frontendUrl string = 'https://${frontend.properties.configuration.ingress.fqdn}'
output backendInternalFqdn string = backend.properties.configuration.ingress.fqdn
output acrLoginServer string = acr.properties.loginServer
