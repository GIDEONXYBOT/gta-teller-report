import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";

async function testLogin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const username = "admin";
    const password = "12345";

    const user = await User.findOne({ username });
    if (!user) {
      console.log("❌ User not found!");
      process.exit(1);
    }

    console.log("📋 User Info:");
    console.log("   Username:", user.username);
    console.log("   Name:", user.name || "N/A");
    console.log("   Role:", user.role);
    console.log("   Status:", user.status);
    console.log("   plainTextPassword:", user.plainTextPassword || "N/A");
    console.log("   Hashed Password:", user.password ? user.password.substring(0, 30) + "..." : "N/A");
    console.log("");

    // Test if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("🔐 Testing password '12345':", isMatch ? "✅ MATCH" : "❌ NO MATCH");
    
    if (!isMatch) {
      console.log("\n❌ Password does not match. Trying to fix...");
      const newHash = await bcrypt.hash(password, 10);
      user.password = newHash;
      user.plainTextPassword = password;
      await user.save();
      console.log("✅ Password updated for", username);
    }
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

testLogin();
