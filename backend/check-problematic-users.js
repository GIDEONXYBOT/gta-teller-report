import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "./models/User.js";

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    console.log("=== CHECKING PROBLEMATIC USERS ===");
    const problematicUsers = ['mlaburada29', '006erika', '021.Irah', '015.mitch', 'yamie22'];
    
    for (let username of problematicUsers) {
      const user = await User.findOne({ username });
      if (user) {
        console.log(`${user.username} (${user.name})`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Status: ${user.status}`);
        console.log(`  Active: ${user.active}`);
        console.log(`  SupervisorId: ${user.supervisorId || 'NONE'}`);
        console.log('---');
      }
    }
    
    console.log("\n=== CHECKING WORKING USERS ===");
    const workingUsers = ['Marie Q.', 'Dianne008', 'Sheena16'];
    
    for (let username of workingUsers) {
      const user = await User.findOne({ username });
      if (user) {
        console.log(`${user.username} (${user.name})`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Status: ${user.status}`);
        console.log(`  Active: ${user.active}`);
        console.log(`  SupervisorId: ${user.supervisorId || 'NONE'}`);
        console.log('---');
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

checkUsers();