@echo off
echo ========================================
echo SyncBridge Database Setup
echo ========================================
echo.

REM Set PostgreSQL paths
set PSQL_PATH="C:\Program Files\PostgreSQL\17\bin\psql.exe"
set PGPASSWORD=Welcome123

REM Check if PostgreSQL is installed
echo Checking PostgreSQL installation...
if not exist %PSQL_PATH% (
    echo.
    echo ERROR: PostgreSQL is not installed at expected location!
    echo Expected: %PSQL_PATH%
    echo.
    echo Please install PostgreSQL:
    echo 1. Download from: https://www.postgresql.org/download/windows/
    echo 2. Run the installer
    echo 3. Use these settings:
    echo    - Port: 5432 (default)
    echo    - Password: Welcome123
    echo    - Install all components
    echo    - Install to default location: C:\Program Files\PostgreSQL\17\
    echo.
    echo After installation, restart this script.
    echo.
    pause
    exit /b 1
)

echo PostgreSQL found at: %PSQL_PATH%

REM Check if PostgreSQL service is running
echo Checking PostgreSQL service...
sc query postgresql-x64-17 >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo WARNING: PostgreSQL service not running!
    echo Attempting to start PostgreSQL service...
    net start postgresql-x64-17
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to start PostgreSQL service!
        echo Please start it manually from Services (services.msc)
        echo.
        pause
        exit /b 1
    )
    echo PostgreSQL service started successfully!
)

REM Check if we can connect to PostgreSQL
echo Testing PostgreSQL connection...
%PSQL_PATH% -U postgres -h localhost -c "SELECT version();" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Cannot connect to PostgreSQL!
    echo.
    echo Possible solutions:
    echo 1. Check if PostgreSQL is running
    echo 2. Verify password is 'Welcome123'
    echo 3. Try connecting manually: %PSQL_PATH% -U postgres
    echo.
    pause
    exit /b 1
)

echo PostgreSQL connection successful!

REM Check if database exists
echo Checking if 'syncbridge' database exists...
%PSQL_PATH% -U postgres -h localhost -d syncbridge -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Database 'syncbridge' does not exist. Creating it...
    %PSQL_PATH% -U postgres -h localhost -c "CREATE DATABASE syncbridge;"
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to create database!
        echo Please create it manually:
        echo 1. Open pgAdmin or run: %PSQL_PATH% -U postgres
        echo 2. Connect as postgres user
        echo 3. Run: CREATE DATABASE syncbridge;
        echo.
        pause
        exit /b 1
    )
    echo Database 'syncbridge' created successfully!
) else (
    echo Database 'syncbridge' already exists!
)

REM Test final connection
echo Testing final database connection...
%PSQL_PATH% -U postgres -h localhost -d syncbridge -c "SELECT 'Database connection successful!' as status;"
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Final database test failed!
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Database setup completed successfully!
echo ========================================
echo.
echo You can now run SyncBridge:
echo 1. Double-click: dist-electron-fi\win-unpacked\SyncBridge.exe
echo 2. Or run: .\launch-syncbridge-with-db.bat
echo.
pause 