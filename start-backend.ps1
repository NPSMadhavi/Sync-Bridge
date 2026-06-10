# Start SyncBridge Backend Server
Write-Host "Starting SyncBridge Backend Server..." -ForegroundColor Green

# Set environment variables
$env:NODE_ENV = "production"
$env:DATABASE_URL = "postgresql://postgres:Welcome123@localhost:5432/syncbridge"
$env:SESSION_SECRET = "your-secure-session-secret"

# Start the server
Write-Host "Starting server on http://localhost:5000" -ForegroundColor Yellow
node dist/index.js