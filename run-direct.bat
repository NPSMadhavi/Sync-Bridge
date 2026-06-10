@echo off
echo ========================================
echo     SyncBridge Direct Launch
echo ========================================
echo.
echo Launching SyncBridge directly from win-unpacked...
echo.

cd /d "%~dp0"
"dist-electron\win-unpacked\SyncBridge.exe"

echo.
echo SyncBridge has been closed.
pause 