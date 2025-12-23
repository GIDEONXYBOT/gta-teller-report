import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function fixAdminBaseSalary() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log("✅ Connected to MongoDB");

    // Find admin users and set their baseSalary to 0
    const adminUsers = await User.find({ role: { $in: ['admin', 'super_admin'] } }).select("username name role baseSalary").lean();

    console.log('Admin users found:', adminUsers);

    for (const user of adminUsers) {
      if (user.baseSalary !== 0) {
        await User.findByIdAndUpdate(user._id, { $set: { baseSalary: 0 } });
        console.log(`🔧 Fixed ${user.name || user.username}: baseSalary set to ₱0`);
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

fixAdminBaseSalary();