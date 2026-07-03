# Stop SyncBridge dev server processes (tsx/node running server/index.ts)
$procs = Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'server[\\/]index\.ts' -or $_.CommandLine -match 'tsx.*server' }

if (-not $procs) {
  Write-Host "No SyncBridge server processes found."
  exit 0
}

foreach ($proc in $procs) {
  Write-Host "Stopping SyncBridge server PID $($proc.ProcessId)..."
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}
