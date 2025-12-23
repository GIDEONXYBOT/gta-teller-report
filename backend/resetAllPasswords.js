import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";

async function resetAllPasswords() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const users = await User.find({});
    console.log(`📊 Found ${users.length} users`);

    const newPassword = "12345";
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    let updated = 0;
    for (const user of users) {
      user.password = hashedPassword;
      user.plainTextPassword = newPassword;
      await user.save();
      updated++;
      console.log(`✅ Reset password for ${user.username} to: 12345`);
    }

    console.log(`\n🎉 Reset ${updated} users' passwords to: 12345`);
    console.log("⚠️  All users can now login with password: 12345");
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

resetAllPasswords();
