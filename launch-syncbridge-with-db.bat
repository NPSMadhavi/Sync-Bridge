@echo off
echo ========================================
echo SyncBridge Desktop Application Launcher
echo ========================================
echo.

echo Checking PostgreSQL service...
sc query postgresql-x64-17 >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PostgreSQL service is not running!
    echo Please start the PostgreSQL service first.
    pause
    exit /b 1
)
echo PostgreSQL service is running.

echo.
echo Checking database connection...
set PGPASSWORD=Welcome123
"C:\Program Files\postgresql\17\bin\psql.exe" -h localhost -U postgres -d syncbridge -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Cannot connect to database!
    echo Please ensure PostgreSQL is running and the syncbridge database exists.
    pause
    exit /b 1
)
echo Database connection successful!

echo.
echo Starting SyncBridge application...
echo.

if exist "dist-electron-new\win-unpacked\SyncBridge.exe" (
    echo SyncBridge is starting...
    echo If you see any errors, please check the console output.
    echo.
    "dist-electron-new\win-unpacked\SyncBridge.exe"
) else (
    echo ERROR: SyncBridge.exe not found!
    echo Please build the application first using: npm run electron:build
    pause
    exit /b 1
)

pause 