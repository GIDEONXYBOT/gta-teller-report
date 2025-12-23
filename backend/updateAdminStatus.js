import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "./models/User.js";

async function updateAdminStatus() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const admin = await User.findOne({ username: "admin" });
    if (!admin) {
      console.log("❌ Admin user not found");
      process.exit(1);
    }

    admin.status = "approved";
    await admin.save();
    console.log("✅ Admin status updated to approved");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating admin:", err);
    process.exit(1);
  }
}

updateAdminStatus();