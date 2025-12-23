// Check what users are available in the restored Atlas database
import mongoose from "mongoose";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function checkAtlasUsers() {
  try {
    console.log("🔌 Connecting to Atlas:", MONGO_URI.split('@')[1]?.split('?')[0]);
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB Atlas");
    
    // Check total users
    const userCount = await User.countDocuments();
    console.log(`👥 Total users in Atlas database: ${userCount}`);
    
    if (userCount > 0) {
      // Show all users by role
      const adminUsers = await User.find({ role: "admin" }).select("username name status");
      const supervisors = await User.find({ role: { $in: ["supervisor", "supervisor_teller"] } }).select("username name status");
      const tellers = await User.find({ role: "teller" }).select("username name status supervisorId");
      
      console.log("\n👑 ADMIN USERS:");
      adminUsers.forEach(user => {
        console.log(`  - ${user.username} (${user.name}) - ${user.status}`);
      });
      
      console.log("\n👨‍💼 SUPERVISORS:");
      supervisors.forEach(user => {
        console.log(`  - ${user.username} (${user.name}) - ${user.status}`);
      });
      
      console.log("\n🏧 TELLERS:");
      tellers.forEach(user => {
        console.log(`  - ${user.username} (${user.name}) - ${user.status} - Supervisor: ${user.supervisorId || 'None'}`);
      });
      
      console.log(`\n📊 SUMMARY: ${adminUsers.length} admins, ${supervisors.length} supervisors, ${tellers.length} tellers`);
    }
    
  } catch (error) {
    console.error("❌ Atlas connection failed:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB Atlas");
  }
}

checkAtlasUsers();