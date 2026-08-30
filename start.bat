@echo off
setlocal

echo ==================================================
echo   Skylark Drones - Monday.com BI Agent
    echo ==================================================

call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. Run npm install and review the logs.
  pause
  exit /b 1
)

start "Skylark BI Agent Server" cmd /c "npm start"

echo.
echo Server starting on http://localhost:3000
 echo If you need a temporary public URL, expose port 3000 with your preferred secure tunnel.

echo.
pause
