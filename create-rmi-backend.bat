@echo off
TITLE RMI Teller Report Backend Auto Builder
COLOR 0A
echo.
echo =====================================================
echo      🚀 RMI Teller Report Backend Auto Builder
echo =====================================================
echo.

REM --- Check Node.js ---
where node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo ⚠️ Node.js not found!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b
)
echo ✅ Node.js detected
echo.

REM --- Create project structure ---
set ROOT=%USERPROFILE%\rmi-teller-report
set BACKEND=%ROOT%\backend
set MODELS=%BACKEND%\models
set ROUTES=%BACKEND%\routes

mkdir "%ROOT%" >nul 2>nul
mkdir "%BACKEND%" >nul 2>nul
mkdir "%MODELS%" >nul 2>nul
mkdir "%ROUTES%" >nul 2>nul

echo ✅ Folder structure created at %BACKEND%
cd /d "%BACKEND%"

REM --- Initialize npm ---
if not exist "package.json" (
    echo 📦 Initializing Node.js project...
    call npm init -y >nul
)

REM --- Install dependencies ---
echo 🔧 Installing dependencies (express, mongoose, cors, bcryptjs, jsonwebtoken, dotenv)...
call npm install express mongoose cors bcryptjs jsonwebtoken dotenv >nul

REM --- Create .env file ---
(
echo PORT=5000
echo MONGO_URI=mongodb+srv://YOUR_MONGO_CONNECTION_STRING
echo JWT_SECRET=your_secret_key
) > "%BACKEND%\.env"

REM --- Create server.js ---
(
echo import express from "express";
echo import mongoose from "mongoose";
echo import cors from "cors";
echo import dotenv from "dotenv";
echo import authRoutes from "./routes/authRoutes.js";
echo import tellerRoutes from "./routes/tellerRoutes.js";
echo dotenv.config();
echo.
echo const app = express();
echo app.use(cors());
echo app.use(express.json());
echo.
echo mongoose.connect(process.env.MONGO_URI)
echo   .then(() => console.log("✅ MongoDB Connected"))
echo   .catch(err => console.error(err));
echo.
echo app.use("/api/auth", authRoutes);
echo app.use("/api/teller", tellerRoutes);
echo.
echo app.get("/", (req, res) => res.send("RMI Teller Report API Running"));
echo.
echo const PORT = process.env.PORT ^|^| 5000;
echo app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
) > "%BACKEND%\server.js"

REM --- Create User model ---
(
echo import mongoose from "mongoose";
echo.
echo const userSchema = new mongoose.Schema({
echo   name: { type: String, required: true },
echo   email: { type: String, required: true, unique: true },
echo   password: { type: String, required: true },
echo   role: { type: String, enum: ["admin", "supervisor"], default: "supervisor" },
echo }, { timestamps: true });
echo.
echo export default mongoose.model("User", userSchema);
) > "%MODELS%\User.js"

REM --- Create Teller Report model ---
(
echo import mongoose from "mongoose";
echo.
echo const tellerSchema = new mongoose.Schema({
echo   supervisor_name: String,
echo   teller_name: String,
echo   type: { type: String, enum: ["Cash In", "Cash Out"], required: true },
echo   amount: { type: Number, default: 0 },
echo   date: { type: Date, default: Date.now },
echo }, { timestamps: true });
echo.
echo export default mongoose.model("TellerReport", tellerSchema);
) > "%MODELS%\TellerReport.js"

REM --- Create authRoutes.js ---
(
echo import express from "express";
echo import bcrypt from "bcryptjs";
echo import jwt from "jsonwebtoken";
echo import User from "../models/User.js";
echo const router = express.Router();
echo.
echo // Register user
echo router.post("/register", async (req, res) => {
echo   try {
echo     const { name, email, password, role } = req.body;
echo     const hashed = await bcrypt.hash(password, 10);
echo     const user = await User.create({ name, email, password: hashed, role });
echo     res.json(user);
echo   } catch (err) { res.status(500).json({ error: err.message }); }
echo });
echo.
echo // Login
echo router.post("/login", async (req, res) => {
echo   try {
echo     const { email, password } = req.body;
echo     const user = await User.findOne({ email });
echo     if (!user) return res.status(404).json({ message: "User not found" });
echo     const valid = await bcrypt.compare(password, user.password);
echo     if (!valid) return res.status(401).json({ message: "Invalid password" });
echo     const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
echo     res.json({ token, user });
echo   } catch (err) { res.status(500).json({ error: err.message }); }
echo });
echo.
echo export default router;
) > "%ROUTES%\authRoutes.js"

REM --- Create tellerRoutes.js ---
(
echo import express from "express";
echo import TellerReport from "../models/TellerReport.js";
echo const router = express.Router();
echo.
echo // Add teller transaction
echo router.post("/", async (req, res) => {
echo   try {
echo     const report = await TellerReport.create(req.body);
echo     res.json(report);
echo   } catch (err) { res.status(500).json({ error: err.message }); }
echo });
echo.
echo // Get teller reports (filter by supervisor)
echo router.get("/", async (req, res) => {
echo   try {
echo     const { supervisor } = req.query;
echo     const filter = supervisor ? { supervisor_name: supervisor } : {};
echo     const reports = await TellerReport.find(filter).sort({ createdAt: -1 });
echo     res.json(reports);
echo   } catch (err) { res.status(500).json({ error: err.message }); }
echo });
echo.
echo export default router;
) > "%ROUTES%\tellerRoutes.js"

echo.
echo ✅ All files created successfully!
echo.
echo You can now start your server by running:
echo ---------------------------------------
echo cd "%BACKEND%"
echo node server.js
echo ---------------------------------------
echo.
pause
exit /b
