@echo off
echo Closing Chrome...
taskkill /f /im chrome.exe 2>nul

echo Starting Chrome with Bluetooth flags...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --enable-web-bluetooth ^
  --unsafely-treat-insecure-origin-as-secure=http://localhost:5173,http://192.168.0.167:5173 ^
  --ignore-certificate-errors ^
  --allow-running-insecure-content ^
  "http://localhost:5173"

echo Chrome started with Bluetooth support enabled for local development.
pause