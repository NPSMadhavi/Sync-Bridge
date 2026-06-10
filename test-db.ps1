Write-Host "Testing PostgreSQL connection..." -ForegroundColor Yellow

# Set PostgreSQL path
$PSQL_PATH = "C:\Program Files\postgresql\17\bin\psql.exe"
$env:PGPASSWORD = "root"

# Check if PostgreSQL is installed
if (Test-Path $PSQL_PATH) {
    Write-Host "PostgreSQL found at: $PSQL_PATH" -ForegroundColor Green
    
    # Test connection to syncbridge_backup
    try {
        Write-Host "Testing connection to syncbridge_backup database..." -ForegroundColor Yellow
        $result = & $PSQL_PATH -U postgres -h localhost -d syncbridge_backup -c "SELECT current_database(), current_user, version();"
        Write-Host "Connection successful!" -ForegroundColor Green
        Write-Host $result
    }
    catch {
        Write-Host "Connection failed: $($_.Exception.Message)" -ForegroundColor Red
        
        # Try to list databases
        Write-Host "Listing available databases..." -ForegroundColor Yellow
        try {
            $dbs = & $PSQL_PATH -U postgres -h localhost -c "\l"
            Write-Host $dbs
        }
        catch {
            Write-Host "Cannot list databases: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}
else {
    Write-Host "PostgreSQL not found at expected location: $PSQL_PATH" -ForegroundColor Red
    Write-Host "Please check if PostgreSQL is installed." -ForegroundColor Yellow
}
