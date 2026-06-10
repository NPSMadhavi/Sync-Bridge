@echo off
echo ========================================
echo        SyncBridge Demo Mode
echo ========================================
echo.
echo This will launch SyncBridge in demo mode.
echo No database required - just the UI for testing.
echo.
echo Note: You will see 404 errors because there's no backend.
echo This is normal in demo mode.
echo.
echo Press any key to launch the app...
pause >nul

echo.
echo Launching SyncBridge Demo...
start "" "dist-electron\win-unpacked\SyncBridge.exe"

echo.
echo ========================================
echo           Demo Mode Started
echo ========================================
echo.
echo SyncBridge is running in demo mode.
echo.
echo What you can do:
echo - See the application interface
echo - Navigate through the UI
echo - Test the layout and design
echo.
echo What you cannot do:
echo - Log in (no backend server)
echo - Save data (no database)
echo - Use actual features
echo.
echo To get full functionality:
echo - Install PostgreSQL database
echo - Use launch-syncbridge.bat instead
echo.
echo To close: Close the SyncBridge window
pause