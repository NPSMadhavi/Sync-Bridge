@echo off
echo ========================================
echo        SyncBridge Launcher
echo ========================================
echo.

REM Set environment variables
set NODE_ENV=production
set DATABASE_URL=postgresql://postgres:Welcome123@localhost:5432/syncbridge
set SESSION_SECRET=your-secure-session-secret
set OPENAI_API_KEY=demo-key-not-used

echo Starting backend server...
start /B cmd /c "set NODE_ENV=production && set DATABASE_URL=postgresql://postgres:Welcome123@localhost:5432/syncbridge && set SESSION_SECRET=your-secure-session-secret && set OPENAI_API_KEY=demo-key-not-used && node dist/index.js"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo Launching SyncBridge...
start "" "dist-electron\win-unpacked\SyncBridge.exe"

echo.
echo ========================================
echo        SyncBridge Started!
echo ========================================
echo.
echo Backend: http://localhost:5000
echo Electron App: Launched
echo.
echo To stop: Close the SyncBridge window
pause 