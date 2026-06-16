using './main.bicep'

// Values are read from environment variables so the same file works locally and
// in CI without storing secrets in source. Required vars (no default) fail the
// deploy if unset. See infra/bootstrap.sh and .github/workflows/deploy.yml.

param namePrefix = readEnvironmentVariable('NAME_PREFIX', 'scout')
param acrName = readEnvironmentVariable('ACR_NAME', 'scoutacr')

// Image tags — set by the CI build step to <loginServer>/<repo>:<git-sha>.
param backendImage = readEnvironmentVariable('BACKEND_IMAGE')
param frontendImage = readEnvironmentVariable('FRONTEND_IMAGE')

// 0 = scale-to-zero (cheapest). Flip to 1 for always-on if cold starts / dropped
// scans become a problem.
param backendMinReplicas = int(readEnvironmentVariable('BACKEND_MIN_REPLICAS', '0'))

// Secrets / integration config (optional ones default to empty → feature off).
param jwtSecret = readEnvironmentVariable('JWT_SECRET')
param geminiApiKey = readEnvironmentVariable('GEMINI_API_KEY', '')
param databricksApiKey = readEnvironmentVariable('DATABRICKS_API_KEY', '')
param databricksApiBase = readEnvironmentVariable('DATABRICKS_API_BASE', '')
param databricksModel = readEnvironmentVariable('DATABRICKS_MODEL', 'databricks-gemini-3-pro')

param microsoftClientId = readEnvironmentVariable('MICROSOFT_CLIENT_ID', '')
param microsoftTenantId = readEnvironmentVariable('MICROSOFT_TENANT_ID', 'organizations')
param enableMicrosoftSso = bool(readEnvironmentVariable('ENABLE_MICROSOFT_SSO', 'false'))
