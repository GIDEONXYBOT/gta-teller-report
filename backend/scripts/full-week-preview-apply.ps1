# PowerShell helper to preview/apply/undo full-week selection
param(
  [string]$Host = "http://localhost:5000",
  [string]$Username = "admin",
  [string]$Password = "admin123",
  [string]$weekKey = "",
  [string[]]$tellerIds = @(),
  [int]$count = 0,
  [switch]$apply,
  [string]$auditId = ""
)

$loginUrl = "$Host/api/auth/login"
$body = @{ username = $Username; password = $Password } | ConvertTo-Json
Write-Host "Logging in as $Username..."
$resp = Invoke-RestMethod -Method POST -Uri $loginUrl -Body $body -ContentType 'application/json' -ErrorAction Stop
$token = $resp?.token
if (-not $token) { Write-Error "Failed to get token"; exit 1 }
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = 'application/json' }

if ($apply) {
  $payload = @{ weekKey = $weekKey; tellerIds = $tellerIds; count = $count; confirmApply = $true } | ConvertTo-Json -Depth 5
  $r = Invoke-RestMethod -Method PUT -Uri "$Host/api/schedule/full-week" -Headers $headers -Body $payload -ErrorAction Stop
  Write-Host "Apply result:`n" (ConvertTo-Json $r -Depth 5)
  exit 0
}

if ($auditId) {
  $r = Invoke-RestMethod -Method POST -Uri "$Host/api/schedule/full-week/undo/$auditId" -Headers $headers -ErrorAction Stop
  Write-Host "Undo result:`n" (ConvertTo-Json $r -Depth 5)
  exit 0
}

# Preview
$payload = @{ weekKey = $weekKey; tellerIds = $tellerIds; count = $count } | ConvertTo-Json -Depth 5
$r = Invoke-RestMethod -Method PUT -Uri "$Host/api/schedule/full-week?preview=true" -Headers $headers -Body $payload -ErrorAction Stop
Write-Host "Preview result:`n" (ConvertTo-Json $r -Depth 5)
