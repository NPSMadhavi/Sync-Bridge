# PostgreSQL Helper Script
# This script provides psql functionality without modifying PATH

# Set PostgreSQL path
$PSQL_PATH = "C:\Program Files\postgresql\17\bin\psql.exe"

# Function to run psql with full path
function Invoke-PSQL {
    param(
        [string]$Command,
        [string]$Database = "",
        [string]$User = "postgres",
        [string]$Host = "localhost"
    )
    
    # Set password environment variable
    $env:PGPASSWORD = "Welcome123"
    
    # Build the command
    $args = @("-U", $User, "-h", $Host)
    
    if ($Database) {
        $args += @("-d", $Database)
    }
    
    if ($Command) {
        $args += @("-c", $Command)
    }
    
    # Execute psql
    try {
        & $PSQL_PATH @args
    }
    catch {
        Write-Host "Error running psql: $_" -ForegroundColor Red
    }
}

# Function to check if PostgreSQL is available
function Test-PostgreSQL {
    if (Test-Path $PSQL_PATH) {
        Write-Host "PostgreSQL found at: $PSQL_PATH" -ForegroundColor Green
        return $true
    } else {
        Write-Host "PostgreSQL not found at: $PSQL_PATH" -ForegroundColor Red
        Write-Host "Please install PostgreSQL to: C:\Program Files\postgresql\17\" -ForegroundColor Yellow
        return $false
    }
}

# Function to test database connection
function Test-DatabaseConnection {
    param([string]$Database = "syncbridge")
    
    if (-not (Test-PostgreSQL)) {
        return $false
    }
    
    try {
        $result = Invoke-PSQL -Command "SELECT 1;" -Database $Database
        Write-Host "Database connection successful!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "Database connection failed!" -ForegroundColor Red
        return $false
    }
}

# Function to create database
function New-SyncBridgeDatabase {
    if (-not (Test-PostgreSQL)) {
        return $false
    }
    
    Write-Host "Creating syncbridge database..." -ForegroundColor Yellow
    try {
        Invoke-PSQL -Command "CREATE DATABASE syncbridge;"
        Write-Host "Database 'syncbridge' created successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "Failed to create database!" -ForegroundColor Red
        return $false
    }
}

# Export functions for use in other scripts
Export-ModuleMember -Function Invoke-PSQL, Test-PostgreSQL, Test-DatabaseConnection, New-SyncBridgeDatabase

# Display usage information
Write-Host "PostgreSQL Helper Script Loaded" -ForegroundColor Cyan
Write-Host "Available functions:" -ForegroundColor Yellow
Write-Host "  Test-PostgreSQL" -ForegroundColor White
Write-Host "  Test-DatabaseConnection" -ForegroundColor White
Write-Host "  New-SyncBridgeDatabase" -ForegroundColor White
Write-Host "  Invoke-PSQL -Command 'SELECT version();'" -ForegroundColor White
Write-Host "" 