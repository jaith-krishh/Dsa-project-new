@echo off
echo Starting Dynamic Event Scheduler Frontend...
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH
    echo Please install Python 3.x and try again
    echo You can download it from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Start the server
echo Starting web server...
python server.py

pause
