$connections = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if (-not $connections) {
  exit 0
}

$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $pids) {
  Write-Host "Stopping process on port 5000 (PID $procId)..."
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}
