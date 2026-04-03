@echo off
REM ============================================================
REM Nexus Chat - Local Development Startup (Windows)
REM ============================================================
REM Usage: start_dev.bat
REM ============================================================

echo ======================================
echo       Nexus Chat - Dev Mode
echo ======================================

cd /d "%~dp0"

REM --- Check for .env ---
if not exist .env (
    echo WARNING: No .env file found. Creating from .env.example...
    copy .env.example .env
    echo    Edit .env to add your API keys, then re-run.
    pause
    exit /b 1
)

REM --- Backend setup ---
echo.
echo Setting up Python environment...

if not exist .venv (
    python -m venv .venv
    echo   Created virtual environment
)

call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

REM --- Frontend setup ---
echo.
echo Setting up frontend...

cd frontend
if not exist node_modules (
    npm install
)

echo   Building frontend...
npm run build
cd ..

REM --- Start ---
echo.
echo Starting Nexus Chat...
echo   http://localhost:8000
echo.

python -m backend.main
