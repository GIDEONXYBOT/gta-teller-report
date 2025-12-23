import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const existing = await User.findOne({ username: "admin" });
    if (existing) {
      console.log("Admin user already exists:", existing.username);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash("admin123", 10);

    const admin = new User({
      username: "admin",
      name: "Administrator",
      role: "super_admin",
      status: "approved",
      active: true,
      verified: true,
      password: hashedPassword,
      plainTextPassword: "admin123",
    });

    await admin.save();
    console.log("✅ Admin created. Username: admin Password: admin123");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding admin:", err);
    process.exit(1);
  }
}

seedAdmin();
