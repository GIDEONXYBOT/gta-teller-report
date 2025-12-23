import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "./models/User.js";

async function showAllPasswords() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const users = await User.find({}).sort({ username: 1 });
    console.log("📋 USER PASSWORDS LIST:");
    console.log("═══════════════════════════════════════════════════════════");

    users.forEach((user, index) => {
      const password = user.plainTextPassword || "(not set - password is hashed)";
      const role = user.role || "unknown";
      const status = user.status || "unknown";
      
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   Name: ${user.name || "N/A"}`);
      console.log(`   Role: ${role}`);
      console.log(`   Status: ${status}`);
      console.log(`   Password: ${password}`);
      console.log(`   Hashed: ${user.password ? user.password.substring(0, 20) + "..." : "N/A"}`);
      console.log("───────────────────────────────────────────────────────────");
    });

    console.log(`\n✅ Total users: ${users.length}`);
    console.log("\n💡 Note: Passwords shown are from 'plainTextPassword' field");
    console.log("   If '(not set)', the original password cannot be recovered.");
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

showAllPasswords();
