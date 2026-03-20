@echo off

echo ================================
echo Docker Auto-Deploy Script
echo ================================

echo [1/3] Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo Checking if Docker is ready...
:check_docker
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker is not ready yet, waiting 5 more seconds...
    timeout /t 5 /nobreak >nul
    goto check_docker
)
echo Docker Desktop is running!

echo.
echo [2/3] Managing Docker containers...
echo Stopping existing containers...
docker compose down

echo.
echo [3/3] Getting ready to open the browser...
echo (The browser will automatically open in 10 seconds while the app boots)
start /b cmd /c "timeout /t 10 /nobreak >nul & start http://localhost:5173"

echo.
echo Building and starting containers (Attached Mode)...
echo ==============================================================
echo  *** YOU CAN NOW CLOSE THIS WINDOW TO STOP THE APP ***
echo ==============================================================
docker compose up --build
if %errorlevel% neq 0 (
    echo Error: Failed to start containers. Check Docker Desktop.
    pause
    exit /b 1
)

echo.
echo Cleaning up containers...
docker compose down
echo.

pause
