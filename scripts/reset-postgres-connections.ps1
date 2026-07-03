# Clears stale PostgreSQL connections by restarting the service on port 5433.
# Run PowerShell as Administrator if restart fails.

$ErrorActionPreference = "Continue"

function Get-PostgresServiceForPort([int]$Port) {
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess
  if (-not $listener) {
    return $null
  }
  $proc = Get-Process -Id $listener -ErrorAction SilentlyContinue
  if (-not $proc) {
    return $null
  }
  Write-Host "Port $Port is used by postgres PID $($proc.Id)"
  foreach ($svc in Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue) {
    return $svc
  }
  return $null
}

$services = @("postgresql-x64-18", "postgresql-x64-17")
$restarted = $false

foreach ($name in $services) {
  $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
  if (-not $svc) { continue }
  Write-Host "Restarting $name ..."
  try {
    Restart-Service -Name $name -Force -ErrorAction Stop
    Write-Host "Restarted $name"
    $restarted = $true
    Start-Sleep -Seconds 3
  } catch {
    Write-Warning "Could not restart ${name}: $($_.Exception.Message)"
    Write-Warning "Run this script in an Administrator PowerShell window."
  }
}

if (-not $restarted) {
  Write-Host ""
  Write-Host "Manual fix: Open Services (services.msc), restart PostgreSQL Server 17 or 18, then run npm run dev."
  exit 1
}

Write-Host "PostgreSQL restarted. You can start the app with: npm run dev"
