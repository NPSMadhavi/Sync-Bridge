@echo off
echo ========================================
echo Rebuilding SyncBridge with new DB config
echo ========================================
echo.

echo Step 1: Building the application...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo.
echo Step 2: Building Electron app...
call npm run electron:build
if %errorlevel% neq 0 (
    echo ❌ Electron build failed
    pause
    exit /b 1
)

echo.
echo Step 3: Copying updated .env file...
copy server\.env dist-electron-v2\win-unpacked\resources\app.asar.unpacked\server\.env
if %errorlevel% equ 0 (
    echo ✅ .env file copied successfully
) else (
    echo ❌ Failed to copy .env file
)

echo.
echo ========================================
echo Rebuild completed! 
echo You can now run the app from dist-electron-v2
echo ========================================
pause
