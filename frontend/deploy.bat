@echo off
echo 🚀 RMI Teller Report - Production Deployment Helper
echo ==================================================

REM Check if package.json exists
if not exist package.json (
    echo ❌ Error: Run this from the frontend directory!
    echo    cd frontend ^&^& deploy.bat
    pause
    exit /b 1
)

echo 📦 Installing dependencies...
call npm ci

echo 🔧 Building production bundle...
call npm run build

if %errorlevel% equ 0 (
    echo ✅ Build successful!
    echo.
    echo 🎯 Next Steps:
    echo 1. Push to GitHub: git add . ^&^& git commit -m "Production ready" ^&^& git push
    echo 2. Go to Cloudflare Pages and connect your repository
    echo 3. Set build command: npm run build
    echo 4. Set output directory: dist
    echo 5. Add environment variables ^(see CLOUDFLARE-DEPLOYMENT.md^)
    echo.
    echo 📁 Build output is ready in ./dist/
    echo 🌐 Your app is ready for deployment!
) else (
    echo ❌ Build failed. Check the errors above.
    pause
    exit /b 1
)

pause