@echo off
TITLE RMI Teller Report Backend Setup
COLOR 0A
echo.
echo =====================================================
echo     🚀 RMI Teller Report - Backend Auto Installer
echo =====================================================
echo.

REM --- Check if Node.js is installed ---
where node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Node.js not found.
    echo.
    echo Installing Node.js LTS version...
    echo (This will open Node.js website for manual download.)
    start https://nodejs.org/en/download/
    echo Please install Node.js, then re-run this file.
    pause
    exit /b
)

echo ✅ Node.js detected.
echo.

REM --- Create project directories ---
set ROOT=%USERPROFILE%\rmi-teller-report
set BACKEND=%ROOT%\backend

if not exist "%ROOT%" mkdir "%ROOT%"
if not exist "%BACKEND%" mkdir "%BACKEND%"

echo ✅ Created folder structure:
echo %ROOT%
echo %BACKEND%
echo.

REM --- Initialize Node project ---
cd /d "%BACKEND%"
if not exist "package.json" (
    echo 📦 Initializing Node.js project...
    call npm init -y >nul
)

REM --- Install dependencies ---
echo.
echo 🔧 Installing backend dependencies...
call npm install express mongoose cors bcryptjs jsonwebtoken dotenv >nul

REM --- Create default server.js ---
echo.
echo 🧩 Creating default server.js file...
(
echo import express from "express";
echo import mongoose from "mongoose";
echo import cors from "cors";
echo import dotenv from "dotenv";
echo.
echo dotenv.config();
echo const app = express();
echo app.use(cors());
echo app.use(express.json());
echo.
echo mongoose.connect(process.env.MONGO_URI)
echo .then(() => console.log("✅ MongoDB Connected"))
echo .catch(err => console.error(err));
echo.
echo app.get("/", (req, res) => res.send("RMI Teller Report API Running"));
echo.
echo const PORT = process.env.PORT ^|^| 5000;
echo app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
) > "%BACKEND%\server.js"

REM --- Create .env file ---
(
echo PORT=5000
echo MONGO_URI=mongodb+srv://YOUR_MONGO_CONNECTION_STRING
echo JWT_SECRET=your_secret_key
) > "%BACKEND%\.env"

echo.
echo ✅ Setup Complete!
echo --------------------------------------
echo 📁 Project folder: %ROOT%
echo 🌐 Server file: %BACKEND%\server.js
echo ⚙️  To start server: 
echo     cd "%BACKEND%"
echo     node server.js
echo --------------------------------------
echo.
pause
exit /b
