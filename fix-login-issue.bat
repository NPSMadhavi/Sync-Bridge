@echo off
echo ========================================
echo SyncBridge Login Issue Fix
echo ========================================
echo.

echo Step 1: Copying updated .env file to built app...
copy server\.env dist-electron-v2\win-unpacked\resources\app.asar.unpacked\server\.env
if %errorlevel% equ 0 (
    echo ✅ .env file copied successfully
) else (
    echo ❌ Failed to copy .env file
)

echo.
echo Step 2: Testing database connection...
set PGPASSWORD=root
"C:\Program Files\postgresql\17\bin\psql.exe" -U postgres -h localhost -d syncbridge_backup -c "SELECT COUNT(*) as user_count FROM users;" 2>nul
if %errorlevel% equ 0 (
    echo ✅ Database connection successful
) else (
    echo ❌ Database connection failed
    echo Please check if:
    echo - PostgreSQL is running
    echo - syncbridge_backup database exists
    echo - Password is correct (root)
)

echo.
echo Step 3: Checking if users exist...
"C:\Program Files\postgresql\17\bin\psql.exe" -U postgres -h localhost -d syncbridge_backup -c "SELECT name, email, role FROM users LIMIT 5;" 2>nul

echo.
echo ========================================
echo Fix completed! Try running the app again.
echo ========================================
pause
