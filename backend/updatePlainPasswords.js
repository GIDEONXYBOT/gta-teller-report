import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "./models/User.js";

async function updatePlainPasswords() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find all users without plainTextPassword
    const users = await User.find({ 
      $or: [
        { plainTextPassword: { $exists: false } },
        { plainTextPassword: "" }
      ]
    });

    console.log(`📊 Found ${users.length} users without plainTextPassword`);

    let updated = 0;
    for (const user of users) {
      // Set a default password that admin can see and change
      user.plainTextPassword = "12345"; // Default password
      await user.save();
      updated++;
      console.log(`✅ Updated ${user.username} - set plainTextPassword to 12345`);
    }

    console.log(`\n🎉 Updated ${updated} users with default password: 12345`);
    console.log("⚠️  Admin can now see and change these passwords in User Management");
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

updatePlainPasswords();
