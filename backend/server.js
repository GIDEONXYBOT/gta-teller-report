// server.js (final, complete and safe)
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import http from "http";
import { Server } from "socket.io";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import securityMiddleware from './middleware/security.js';

// Utility function to get local IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      const { address, family, internal } = iface;
      if (family === 'IPv4' && !internal) {
        return address;
      }
    }
  }
  return 'localhost';
}

// Initialize app and env
dotenv.config();
const app = express();

// 🔧 Health check CORS preflight - MUST come before security middleware
app.options('/api/health', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// 🔧 Health check and connectivity test endpoint (before security middleware)
app.get('/api/health', (req, res) => {
  try {
    const clientInfo = {
      timestamp: new Date().toISOString(),
      clientIP: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      host: req.headers.host,
      serverIP: getLocalIP(),
      message: 'Backend server is running',
      uptime: process.uptime(),
      nodeVersion: process.version
    };

    console.log('🏥 Health check requested:', clientInfo);
    
    // Set explicit CORS headers for health check
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    res.json(clientInfo);
  } catch (error) {
    console.error('❌ Error in health check:', error);
    res.status(500).json({ message: 'Health check error', error: error.message });
  }
});

// Handle CORS preflight requests for all routes
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, Pragma, x-requested-with');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Production Security Middleware (must be first)
if (process.env.NODE_ENV === 'production') {
  securityMiddleware(app);
} else {
  // Development CORS (mobile-optimized)
  app.use(cors({ 
    origin: ["https://gideon-reports.pages.dev", "https://*.yourdomain.com"], // Allow specific origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Cache-Control", "Pragma"],
    optionsSuccessStatus: 200 // For legacy browser support
  }));
  
  // Handle preflight requests explicitly
  app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, Pragma');
    res.sendStatus(200);
  });
}

// Increase body size limits to support base64 image uploads for avatars
app.use(express.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Request logging middleware with mobile detection
app.use((req, res, next) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    console.log(`📥 ${req.method} ${req.path} from ${req.ip}${isMobile ? ' (Mobile)' : ''}`);
  } catch (error) {
    console.log(`📥 ${req.method} ${req.path} from ${req.ip || 'unknown'}`);
  }
  next();
});

// Database Connection
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

console.log("🔄 Connecting to MongoDB...");
mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000, // 10 second timeout
    socketTimeoutMS: 45000
  })
  .then(async () => {
    console.log("✅ MongoDB connected successfully");

    // Initialize supervisor assignment reset scheduler after DB connection
    try {
      // const { initSupervisorResetScheduler } = await import("./scheduler/supervisorReset.js");
      // await initSupervisorResetScheduler();
      console.log("⏸️ Supervisor reset scheduler disabled for debugging");
    } catch (schedulerError) {
      console.error("❌ Failed to initialize scheduler:", schedulerError);
      // Don't exit, just log the error
    }

    // Initialize leaderboard update scheduler for real-time updates
    try {
      const { initLeaderboardUpdateScheduler } = await import("./scheduler/leaderboardUpdate.js");
      initLeaderboardUpdateScheduler(io);
      console.log("📊 Leaderboard update scheduler initialized");
    } catch (schedulerError) {
      console.error("❌ Failed to initialize leaderboard scheduler:", schedulerError);
    }

    // Initialize chicken fight update scheduler for real-time updates
    try {
      const { initChickenFightUpdateScheduler } = await import("./scheduler/chickenFightUpdate.js");
      initChickenFightUpdateScheduler(io);
      console.log("🐔 Chicken fight update scheduler initialized");
    } catch (schedulerError) {
      console.error("❌ Failed to initialize chicken fight scheduler:", schedulerError);
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    console.warn("⚠️ Starting server without database connection for debugging");
    // Don't exit, try to start server anyway
    // process.exit(1); // Exit if database connection fails
  });

// ======================================================
// ROUTES
// ======================================================
// import payrollRoutes from "./routes/payroll.js";
// import adminRoutes from "./routes/admin.js";
// import adminTellerOverviewRoutes from "./routes/adminTellerOverview.js"; // ✅ new admin teller overview
// import userRoutes from "./routes/users.js";
import settingsRoutes from "./routes/settings.js";
import systemSettingsRoutes from "./routes/systemSettings.js";
import usersRoutes from "./routes/users.js";
import cashflowRoutes from "./routes/cashflow.js";
import payrollRoutes from "./routes/payroll.js";
import tellerReportsRoutes from "./routes/tellerReports.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import adminTellerOverviewRoutes from "./routes/adminTellerOverview.js"; // admin teller overview endpoints
import menuPermissionsRoutes from "./routes/menuPermissions.js";
// import cashflowRoutes from "./routes/cashflow.js";
// import reportRoutes from "./routes/reports.js";
// import schedulerRoutes from "./routes/schedulerRoutes.js";
import authRoutes from "./routes/auth.js"; // ✅ add this
// import chatRoutes from "./routes/chat.js"; // ✅ new chat route
// import scheduleRoutes from "./routes/schedule.js"; // ✅ add this
// import attendanceRoutes from "./routes/attendance.js"; // ✅ new attendance route
// import tellerReportsRoutes from "./routes/tellerReports.js";
// import tellerManagementRoutes from "./routes/teller-management.js";
// import tellersRoutes from "./routes/tellers.js";
import supervisorRoutes from "./routes/supervisor.js";
// import debugRoutes from "./routes/debug.js";
// import deploymentsRoutes from "./routes/deployments.js";
// import staffRoutes from "./routes/staff.js"; // ✅ new staff/employee routes
// import menuPermissionsRoutes from "./routes/menuPermissions.js"; // ✅ menu permissions
// import mapConfigRoutes from "./routes/mapConfig.js"; // ✅ custom map config
// import externalBettingRoutes from "./routes/externalBetting.js"; // ✅ external betting data
// import bettingDataRoutes from "./routes/bettingData.js"; // ✅ manage betting data
import tellerZonesRoutes from "./routes/tellerZones.js"; // ✅ teller zones for assignments
import notificationsRoutes from "./routes/notifications.js"; // ✅ notifications & alerts
import shiftRoutes from "./routes/shift.js"; // ✅ shift management
import shortPaymentsRoutes from "./routes/shortPayments.js"; // ✅ short payment plans
import assetsRoutes from "./routes/assets.js"; // ✅ asset management

// Additional API routes used by the frontend that weren't mounted yet
import reportRoutes from "./routes/reports.js"; // /api/reports
import mapConfigRoutes from "./routes/mapConfig.js"; // /api/map-config
import tellerManagementRoutes from "./routes/teller-management.js"; // /api/teller-management
import deploymentsRoutes from "./routes/deployments.js"; // /api/deployments
import bettingDataRoutes from "./routes/bettingData.js"; // /api/betting-data
import externalBettingRoutes from "./routes/externalBetting.js"; // /api/external-betting
import attendanceRoutes from "./routes/attendance.js"; // /api/attendance
import tellersRoutes from "./routes/tellers.js"; // /api/tellers
import schedulerRoutes from "./routes/schedulerRoutes.js"; // /api/scheduler
import scheduleRoutes from "./routes/schedule.js"; // /api/schedule (frontend expects this)
import transactionsRoutes from "./routes/transactions.js"; // /api/transactions
import employeeRoutes from "./routes/employee.js"; // /api/employee
import cashflowArchiveRoutes from "./routes/cashflowArchive.js"; // /api/cashflow-archive
import reportSingleRoutes from "./routes/dashboard.js"; // /api/report (singular)
import salariesRoutes from "./routes/salaries.js"; // /api/salaries (frontend expects this)
import mediaRoutes from "./routes/media.js"; // /api/media (feed uploads)
import chickenFightRoutes from "./routes/chicken-fight.js"; // 🐔 /api/chicken-fight
import chickenFightRegistrationRoutes from "./routes/chicken-fight-registration.js"; // 🐔 /api/chicken-fight-registration
import drawsRoutes from "./routes/draws.js"; // 📊 /api/draws
import tellerSalaryCalculationRoutes from "./routes/tellerSalaryCalculation.js"; // 📊 /api/teller-salary-calculation
import { initChickenFightSocket } from "./socket/chickenFightSocket.js"; // 🐔 Socket.IO handlers
import { initLeaderboardSocket } from "./socket/leaderboardSocket.js"; // 📊 Leaderboard Socket.IO handlers

// Temporarily disable all routes to test basic server startup
// app.use("/api/payroll", payrollRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/api/admin", adminTellerOverviewRoutes); // ✅ admin teller overview routes
// app.use("/api/external-betting", externalBettingRoutes); // ✅ external betting routes
// app.use("/api/betting-data", bettingDataRoutes); // ✅ manage betting data routes
// app.use("/api/teller-zones", tellerZonesRoutes); // ✅ teller zones routes
// app.use("/api/notifications", notificationsRoutes); // ✅ notifications & alerts routes
// app.use("/api/users", userRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/system-settings", systemSettingsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/cashflow", cashflowRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/teller-reports", tellerReportsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminTellerOverviewRoutes); // add Teller Overview api
app.use("/api/menu-permissions", menuPermissionsRoutes); // used by frontend sidebar
app.use("/api/teller-salary-calculation", tellerSalaryCalculationRoutes); // 📊 Teller salary calculation with overtime
// app.use("/api/cashflow", cashflowRoutes);
// app.use("/api/reports", reportRoutes); // Re-enabled
// app.use("/api/scheduler", schedulerRoutes);
app.use("/api/auth", authRoutes);
// Mount endpoints that frontend relies on (enable missing ones)
app.use("/api/reports", reportRoutes);
app.use("/api/map-config", mapConfigRoutes);
app.use("/api/teller-management", tellerManagementRoutes);
app.use("/api/supervisor", supervisorRoutes);
app.use("/api/deployments", deploymentsRoutes);
app.use("/api/assets", assetsRoutes);
app.use("/api/external-betting", externalBettingRoutes);
app.use("/api/betting-data", bettingDataRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/tellers", tellersRoutes);
app.use("/api/scheduler", schedulerRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/teller-zones", tellerZonesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/shift", shiftRoutes);
app.use("/api/short-payments", shortPaymentsRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/report", reportSingleRoutes); // routes under /api/report/ (e.g. /admin)
app.use("/api/cashflow-archive", cashflowArchiveRoutes);
app.use("/api/salaries", salariesRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/chicken-fight", chickenFightRoutes); // 🐔 Chicken Fight betting system
app.use("/api/chicken-fight-registration", chickenFightRegistrationRoutes); // 🐔 Chicken Fight registration
app.use("/api/draws", drawsRoutes); // 📊 Draw results for regla pattern - updated for public access
// Deployed: 2025-12-08
// app.use("/api/chat", chatRoutes);
// app.use("/api/schedule", scheduleRoutes);
// app.use("/api/attendance", attendanceRoutes);
// app.use("/api/teller-reports", tellerReportsRoutes);
// (deprecated fallback registrations if needed) app.use("/api/teller-management", tellerManagementRoutes);
// app.use("/api/tellers", tellersRoutes);
// app.use("/api/supervisor", supervisorRoutes);
// app.use("/api/staff", staffRoutes); // ✅ staff/employee management
// app.use("/api/menu-permissions", menuPermissionsRoutes); // ✅ menu permissions
// app.use("/api/map-config", mapConfigRoutes); // ✅ custom map config
// app.use("/api/shift", shiftRoutes); // ✅ shift management
// app.use("/api/short-payments", shortPaymentsRoutes); // ✅ short payment plans
// app.use("/api/assets", assetsRoutes); // ✅ asset management
// app.use("/api/debug", debugRoutes);
// app.use("/api/deployments", deploymentsRoutes);

// ======================================================
// STATIC FRONTEND SERVE (Vite build in frontend/dist)
// ======================================================
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // const distPath = path.resolve(__dirname, "../frontend/dist");
  // app.use(express.static(distPath));
  // Serve uploaded assets (avatars, maps, etc.) from /uploads with caching
  const uploadsPath = path.resolve(__dirname, 'uploads');
  
  // Add CORS headers for all /uploads requests
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });
  
  app.use('/uploads', express.static(uploadsPath, {
    maxAge: '1d', // Cache for 1 day
    setHeaders: (res, path) => {
      // Set cache control for images
      if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.gif')) {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      }
    }
  }));
  // SPA fallback: send index.html for non-API routes
  // app.get(/^(?!\/api\/).+/, (req, res) => {
  //   res.sendFile(path.join(distPath, "index.html"));
  // });
  // console.log("🗂️ Serving frontend dist from:", distPath);
} catch (e) {
  console.warn("⚠️ Failed to configure static frontend serving:", e.message);
}

// Handle missing avatar images with default
app.get('/uploads/avatars/*', (req, res) => {
  // In Render, uploads are not persisted, so always serve default avatar
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#e5e7eb"/><circle cx="24" cy="18" r="8" fill="#9ca3af"/><path d="M8 40c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="#9ca3af"/></svg>');
});

// ======================================================
// SOCKET + SCHEDULER SETUP
// ======================================================
// import { scheduleDailyReset } from "./scheduler/midnightReset.js";
// import { Server } from "socket.io";

// Start HTTP + Socket.IO
const server = http.createServer(app);

// ✅ Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      "https://gideon-reports.pages.dev",
      "https://www.rmi.gideonbot.xyz",
      "https://rmi.gideonbot.xyz",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://192.168.0.167:5173"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000
});

// Make io available globally for routes
app.io = io;
global.io = io;

// ✅ Initialize Socket.IO handlers
initChickenFightSocket(io);
initLeaderboardSocket(io);

// ======================================================
// ✅ SOCKET EVENT HANDLERS (DISABLED FOR DEBUGGING)
// ======================================================
/*
if (!global.onlineUsers) global.onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // When user connects
  socket.on("userConnected", (user) => {
    if (user && user._id) {
      user.socketId = socket.id;
      global.onlineUsers.set(user._id, user);
      io.emit("onlineUsers", Array.from(global.onlineUsers.values()));
      console.log(`🟩 ${user.name} (${user.role}) connected`);
    }
  });

  // Typing indicator
  socket.on("typing", (data) => {
    if (data.receiverId && global.onlineUsers.has(data.receiverId)) {
      const receiver = global.onlineUsers.get(data.receiverId);
      io.to(receiver.socketId).emit("userTyping", data);
    } else {
      socket.broadcast.emit("userTyping", data);
    }
  });

  // ✅ Live message handling (private or group)
  socket.on("sendMessage", (msg) => {
    if (!msg || !msg.senderId) return;

    if (!global.sentMessages) global.sentMessages = new Set();
    const msgId = msg._id || Date.now().toString();
    if (global.sentMessages.has(msgId)) return;
    global.sentMessages.add(msgId);
    setTimeout(() => global.sentMessages.delete(msgId), 5000);

    // Private 1-on-1
    if (msg.receiverId && global.onlineUsers.has(msg.receiverId)) {
      const receiver = global.onlineUsers.get(msg.receiverId);
      io.to(receiver.socketId).emit("newMessage", msg);
      io.to(socket.id).emit("newMessage", msg); // also to sender
      console.log(`📩 Private message ${msgId} from ${msg.senderName} ➡️ ${receiver.name}`);
    } else {
      // Group message
      io.emit("newMessage", msg);
      console.log(`💬 Group message ${msgId} broadcast`);
    }
  });

  // ✅ Delete-all sync
  socket.on("messagesCleared", () => {
    io.emit("clearAllMessages");
  });

  // ✅ Handle user disconnect
  socket.on("disconnect", () => {
    for (let [id, u] of global.onlineUsers) {
      if (socket.id === u.socketId) {
        global.onlineUsers.delete(id);
        console.log(`🔴 ${u.name} disconnected`);
        break;
      }
    }
    io.emit("onlineUsers", Array.from(global.onlineUsers.values()));
  });
});
*/

// ======================================================
// ✅ SOCKET EVENT HANDLERS (DISABLED FOR PRODUCTION)
// ======================================================

// Handle socket.io requests (disabled)
app.get('/socket.io/*', (req, res) => {
  res.status(200).json({ message: 'Socket.IO disabled' });
});

// Scheduler setup
// import { initSupervisorResetScheduler } from "./scheduler/supervisorReset.js";

const DEFAULT_RESET_TIME = process.env.RESET_TIME || "04:00";
// Temporarily disable scheduler to fix deployment
// scheduleDailyReset(DEFAULT_RESET_TIME);
// console.log(`🕐 Scheduler set for ${DEFAULT_RESET_TIME} Asia/Manila`);

// Supervisor reset scheduler is now initialized after DB connection (see above)


// ======================================================
// AUTO-DETECT LOCAL IP ADDRESS
// ======================================================
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; // fallback
}

const LOCAL_IP = getLocalIPAddress();

// ======================================================
// START SERVER ON PORT 5000
// ======================================================
const PORT = process.env.PORT || 5000;

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // In development keep the process alive so intermittent runtime errors don't cause
  // the server to fully exit while the developer is iterating. In production we still
  // fail fast and exit so a process manager can restart the service.
  if (process.env.NODE_ENV === 'production') {
    console.error('Process exiting due to unhandledRejection (production)');
    process.exit(1);
  } else {
    console.warn('Continuing (unhandledRejection) — running in non-production mode.');
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  if (process.env.NODE_ENV === 'production') {
    console.error('Process exiting due to uncaughtException (production)');
    process.exit(1);
  } else {
    console.warn('Continuing (uncaughtException) — running in non-production mode.');
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend Server Started`);
  console.log(`📡 Local: http://localhost:${PORT}`);
  console.log(`📡 Network: http://${LOCAL_IP}:${PORT}`);
  // console.log(`🔌 Socket.IO ready for real-time updates\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error(`Kill the process: Get-Process node | Stop-Process -Force\n`);
  } else {
    console.error("❌ Server error:", err);
  }
  if (process.env.NODE_ENV === 'production') {
    // Exit in production to allow a process manager to restart the service.
    process.exit(1);
  } else {
    // In dev, don't kill the process automatically — let the developer investigate.
    console.warn('Server error occurred (non-production) — process kept alive for debugging');
  }
});

export default app;
