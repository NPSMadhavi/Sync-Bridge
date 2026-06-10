@echo off
echo ========================================
echo      SyncBridge Electron Launcher
echo ========================================
echo.

REM Set all required environment variables
set NODE_ENV=production
set DATABASE_URL=postgresql://postgres:Welcome123@localhost:5432/syncbridge
set SESSION_SECRET=your-secure-session-secret
set OPENAI_API_KEY=demo-key-not-used

echo Environment variables set:
echo - NODE_ENV: %NODE_ENV%
echo - DATABASE_URL: %DATABASE_URL%
echo - OPENAI_API_KEY: %OPENAI_API_KEY%
echo.

echo Starting backend server...
start /B cmd /c "set NODE_ENV=production && set DATABASE_URL=postgresql://postgres:Welcome123@localhost:5432/syncbridge && set SESSION_SECRET=your-secure-session-secret && set OPENAI_API_KEY=demo-key-not-used && node dist/index.js"

echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

echo Launching SyncBridge Electron app...
start "" "dist-electron\win-unpacked\SyncBridge.exe"

echo.
echo ========================================
echo           SyncBridge Running
echo ========================================
echo.
echo Backend server: http://localhost:5000
echo Electron app: Launched
echo.
echo If you see 404 errors, the backend may still be starting.
echo Wait a few more seconds and refresh the app.
echo.
echo To stop: Close the SyncBridge window and this console.
pause