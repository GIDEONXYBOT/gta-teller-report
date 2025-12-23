import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const exists = await User.findOne({ username: "admin" });
    if (exists) {
      console.log("⚠️ Admin already exists:", exists.username);
      process.exit(0);
    }

    const admin = new User({
      username: "admin",
      fullName: "System Administrator",
      role: "admin",
    });
    await admin.setPassword("admin123");
    await admin.save();

    console.log("✅ Admin user created:");
    console.log("   Username: admin");
    console.log("   Password: admin123");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding admin:", err);
    process.exit(1);
  }
};

seedAdmin();
