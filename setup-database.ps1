# SyncBridge Database Setup Script
# This script works without modifying system PATH variables

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SyncBridge Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set PostgreSQL paths
$PSQL_PATH = "C:\Program Files\postgresql\17\bin\psql.exe"
$env:PGPASSWORD = "Welcome123"

# Check if PostgreSQL is installed
Write-Host "Checking PostgreSQL installation..." -ForegroundColor Yellow
if (-not (Test-Path $PSQL_PATH)) {
    Write-Host ""
    Write-Host "ERROR: PostgreSQL is not installed at expected location!" -ForegroundColor Red
    Write-Host "Expected: $PSQL_PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "2. Run the installer" -ForegroundColor White
    Write-Host "3. Use these settings:" -ForegroundColor White
    Write-Host "   - Port: 5432 (default)" -ForegroundColor White
    Write-Host "   - Password: Welcome123" -ForegroundColor White
    Write-Host "   - Install all components" -ForegroundColor White
    Write-Host "   - Install to default location: C:\Program Files\postgresql\17\" -ForegroundColor White
    Write-Host ""
    Write-Host "After installation, restart this script." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "PostgreSQL found at: $PSQL_PATH" -ForegroundColor Green

# Check if PostgreSQL service is running
Write-Host "Checking PostgreSQL service..." -ForegroundColor Yellow
$service = Get-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
if (-not $service -or $service.Status -ne "Running") {
    Write-Host ""
    Write-Host "WARNING: PostgreSQL service not running!" -ForegroundColor Yellow
    Write-Host "Attempting to start PostgreSQL service..." -ForegroundColor Yellow
    try {
        Start-Service -Name "postgresql-x64-17" -ErrorAction Stop
        Write-Host "PostgreSQL service started successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host ""
        Write-Host "ERROR: Failed to start PostgreSQL service!" -ForegroundColor Red
        Write-Host "Please start it manually from Services (services.msc)" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to continue"
        exit 1
    }
}

# Check if we can connect to PostgreSQL
Write-Host "Testing PostgreSQL connection..." -ForegroundColor Yellow
try {
    & $PSQL_PATH -U postgres -h localhost -c "SELECT version();" | Out-Null
    Write-Host "PostgreSQL connection successful!" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "ERROR: Cannot connect to PostgreSQL!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible solutions:" -ForegroundColor Yellow
    Write-Host "1. Check if PostgreSQL is running" -ForegroundColor White
    Write-Host "2. Verify password is 'Welcome123'" -ForegroundColor White
    Write-Host "3. Try connecting manually: $PSQL_PATH -U postgres" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to continue"
    exit 1
}

# Check if database exists
Write-Host "Checking if 'syncbridge' database exists..." -ForegroundColor Yellow
try {
    & $PSQL_PATH -U postgres -h localhost -d syncbridge -c "SELECT 1;" | Out-Null
    Write-Host "Database 'syncbridge' already exists!" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "Database 'syncbridge' does not exist. Creating it..." -ForegroundColor Yellow
    try {
        & $PSQL_PATH -U postgres -h localhost -c "CREATE DATABASE syncbridge;"
        Write-Host "Database 'syncbridge' created successfully!" -ForegroundColor Green
    }
    catch {
        Write-Host ""
        Write-Host "ERROR: Failed to create database!" -ForegroundColor Red
        Write-Host "Please create it manually:" -ForegroundColor Yellow
        Write-Host "1. Open pgAdmin or run: $PSQL_PATH -U postgres" -ForegroundColor White
        Write-Host "2. Connect as postgres user" -ForegroundColor White
        Write-Host "3. Run: CREATE DATABASE syncbridge;" -ForegroundColor White
        Write-Host ""
        Read-Host "Press Enter to continue"
        exit 1
    }
}

# Test final connection
Write-Host "Testing final database connection..." -ForegroundColor Yellow
try {
    $result = & $PSQL_PATH -U postgres -h localhost -d syncbridge -c "SELECT 'Database connection successful!' as status;"
    Write-Host $result -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "ERROR: Final database test failed!" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Database setup completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now run SyncBridge:" -ForegroundColor Yellow
Write-Host "1. Double-click: dist-electron-fi\win-unpacked\SyncBridge.exe" -ForegroundColor White
Write-Host "2. Or run: .\launch-syncbridge-with-db.bat" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to continue" 