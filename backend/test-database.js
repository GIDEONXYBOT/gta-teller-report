// Quick script to test database connection and check users
import mongoose from "mongoose";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function testDatabase() {
  try {
    console.log("🔌 Connecting to:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Check users
    const userCount = await User.countDocuments();
    console.log(`👥 Total users in database: ${userCount}`);
    
    if (userCount > 0) {
      const users = await User.find({}).limit(5).select("username name role status");
      console.log("📋 Sample users:");
      users.forEach(user => {
        console.log(`  - ${user.username} (${user.name}) - ${user.role} - ${user.status}`);
      });
    }
    
    // Check tellers specifically
    const tellerCount = await User.countDocuments({ role: "teller" });
    console.log(`🏧 Tellers found: ${tellerCount}`);
    
    if (tellerCount === 0) {
      console.log("❌ No tellers found - this explains why teller management is empty!");
      console.log("💡 Creating a test teller...");
      
      const testTeller = new User({
        username: "test_teller",
        name: "Test Teller",
        role: "teller",
        status: "approved",
        password: "password123" // Will be hashed by the model
      });
      
      await testTeller.save();
      console.log("✅ Test teller created!");
    }
    
  } catch (error) {
    console.error("❌ Database test failed:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

testDatabase();