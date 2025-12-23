@echo off
echo ========================================
echo RMI Teller Report - Production Build
echo ========================================
echo.

echo Building frontend...
cd frontend
if exist dist rmdir /s /q dist
npm run build
if %errorlevel% neq 0 (
    echo ❌ Frontend build failed!
    pause
    exit /b 1
)
echo ✅ Frontend built successfully
cd ..

echo.
echo Starting production server...
echo Backend will serve both API and frontend
echo Access at: http://localhost:5000
echo.
npm start