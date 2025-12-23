import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "./models/User.js";

async function approveAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const admin = await User.findOne({ username: "admin" });
    if (!admin) {
      console.log("❌ Admin user not found!");
      process.exit(1);
    }

    admin.status = "approved";
    admin.active = true;
    await admin.save();
    
    console.log("✅ Admin user approved!");
    console.log("   Username:", admin.username);
    console.log("   Status:", admin.status);
    console.log("   Active:", admin.active);
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

approveAdmin();
