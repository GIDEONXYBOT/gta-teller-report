import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// Simple test route
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "Server is working!" });
});

// Database connection
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rmi_teller_report";

console.log("🔄 Connecting to MongoDB...");
mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000
  })
  .then(() => {
    console.log("✅ MongoDB connected successfully");

    const PORT = 5000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Minimal server running on port ${PORT}`);
      console.log(`📡 Test endpoint: http://localhost:${PORT}/api/test`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });