@echo off
echo ========================================
echo     SyncBridge Database Setup
echo ========================================
echo.

echo Checking PostgreSQL connection...
psql -U postgres -h localhost -c "SELECT version();" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Cannot connect to PostgreSQL
    echo Please make sure PostgreSQL is installed and running
    echo Download from: https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)

echo PostgreSQL is running. Checking for syncbridge database...
psql -U postgres -h localhost -c "SELECT 1 FROM pg_database WHERE datname='syncbridge';" | findstr "1" >nul
if errorlevel 1 (
    echo Database 'syncbridge' does not exist. Creating it...
    psql -U postgres -h localhost -c "CREATE DATABASE syncbridge;"
    if errorlevel 1 (
        echo ERROR: Failed to create database
        pause
        exit /b 1
    )
    echo Database 'syncbridge' created successfully!
) else (
    echo Database 'syncbridge' already exists.
)

echo.
echo ========================================
echo     Database Setup Complete!
echo ========================================
echo.
echo You can now run SyncBridge using:
echo   run-syncbridge.bat
echo.
pause 