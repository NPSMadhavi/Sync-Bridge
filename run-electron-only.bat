@echo off
echo ========================================
echo     SyncBridge Electron Only
echo ========================================
echo.
echo This will launch SyncBridge without the backend server.
echo You will see the UI but API calls will fail.
echo.
echo Press any key to continue...
pause >nul

echo Launching SyncBridge Electron app...
start "" "dist-electron\win-unpacked\SyncBridge.exe"

echo.
echo ========================================
echo        SyncBridge Launched!
echo ========================================
echo.
echo Note: Backend server is not running.
echo API calls will show 404 errors.
echo.
echo To run with full functionality:
echo 1. Run setup-database.bat first
echo 2. Then run run-syncbridge.bat
echo.
pause 