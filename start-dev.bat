@echo off
echo Starting RMI Teller Report System with Auto-Restart...
echo.

start "Backend Server" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak > nul

start "Frontend Server" cmd /k "cd frontend && npm run dev -- --host"

echo.
echo Both servers are starting...
echo Backend: http://localhost:5000 (auto-restart enabled)
echo Frontend: http://localhost:5173 (hot reload enabled)
echo.
echo Press any key to stop all servers...
pause > nul

taskkill /FI "WINDOWTITLE eq Backend Server*" /T /F
taskkill /FI "WINDOWTITLE eq Frontend Server*" /T /F
