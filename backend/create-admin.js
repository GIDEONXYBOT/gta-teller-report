// Create admin user for testing
import mongoose from "mongoose";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function createAdmin() {
  try {
    console.log("🔌 Connecting to:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("ℹ️  Admin user already exists:", existingAdmin.username);
      return;
    }
    
    // Create new admin
    const admin = new User({
      username: "admin",
      name: "Administrator",
      role: "admin",
      status: "approved",
      password: "admin123" // This will be hashed by the User model
    });
    
    await admin.save();
    console.log("✅ Admin user created successfully!");
    console.log("📋 Login credentials:");
    console.log("   Username: admin");
    console.log("   Password: admin123");
    
  } catch (error) {
    console.error("❌ Admin creation failed:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

createAdmin();