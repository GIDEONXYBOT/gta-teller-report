# PowerShell test script for withdraw-all-overrides endpoint
# Usage: .\withdraw-all-overrides.ps1 -Host "http://localhost:5000" -Username "superadmin" -Password "secret"
param(
  [string]$Host = "http://localhost:5000",
  [string]$Username = "admin",
  [string]$Password = "admin123",
  [string]$UserId = "",
  [string]$WeekRange = ""
)

$loginUrl = "$Host/api/auth/login"
$body = @{ username = $Username; password = $Password } | ConvertTo-Json

Write-Host "Logging in as $Username to $loginUrl..."
$resp = Invoke-RestMethod -Method POST -Uri $loginUrl -Body $body -ContentType 'application/json' -ErrorAction Stop
$token = $resp?.token
if (-not $token) { Write-Error "Failed to get token from login response: $resp"; exit 1 }
Write-Host "Got token. Calling withdraw-all-overrides..."

$headers = @{ Authorization = "Bearer $token" }
$payload = @{}
if ($UserId) { $payload.userId = $UserId }
if ($WeekRange) { $payload.weekRange = $WeekRange }

$withdrawUrl = "$Host/api/payroll/withdraw-all-overrides"
$payloadJson = $payload | ConvertTo-Json

try {
  $r = Invoke-RestMethod -Method POST -Uri $withdrawUrl -Headers $headers -Body $payloadJson -ContentType 'application/json' -ErrorAction Stop
  Write-Host "Response:`n" (ConvertTo-Json $r -Depth 5)
} catch {
  Write-Error "Request failed: $_"
  exit 1
}
