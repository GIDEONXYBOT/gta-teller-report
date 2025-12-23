@echo off
echo Setting up HTTPS for local development...
echo.
echo This script will:
echo 1. Install mkcert (certificate tool)
echo 2. Create a trusted local certificate
echo 3. Configure Vite to use HTTPS
echo.

REM Check if chocolatey is installed
choco --version >nul 2>&1
if errorlevel 1 (
    echo Installing Chocolatey...
    powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
)

REM Install mkcert
echo Installing mkcert...
choco install mkcert -y

REM Create certificate directory
if not exist "certs" mkdir certs

REM Generate certificate
echo Generating certificate...
cd certs
mkcert localhost 127.0.0.1 ::1
cd ..

echo.
echo ✅ Certificate created!
echo Now restart your dev server with HTTPS enabled.
echo.
pause