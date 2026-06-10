@echo off
echo ========================================
echo     SyncBridge Launcher
echo ========================================
echo.
echo Launching SyncBridge application...
echo.

cd /d "%~dp0"
start "" "dist-electron\win-unpacked\SyncBridge.exe"

echo.
echo ========================================
echo        SyncBridge Launched!
echo ========================================
echo.
echo The SyncBridge application is now running.
echo.
echo Features:
echo - Loads static files directly (no backend required)
echo - Shows the UI interface
echo - API calls will show 404 errors (backend not running)
echo.
echo To run with full functionality:
echo 1. Run setup-database.bat (if needed)
echo 2. Run run-syncbridge.bat (starts backend + app)
echo.
pause