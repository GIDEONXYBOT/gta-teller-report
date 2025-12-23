// Password reset utility - fixes corrupted password hashes
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function resetUserPassword(username, newPassword) {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");

    const user = await User.findOne({ username });
    if (!user) {
      console.log(`❌ User "${username}" not found`);
      process.exit(1);
    }

    console.log(`\n📋 Current user data for "${username}":`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Password (hash): ${user.password?.substring(0, 30)}...`);
    console.log(`   PlainTextPassword: ${user.plainTextPassword || "(none)"}`);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user
    user.password = hashedPassword;
    user.plainTextPassword = newPassword;
    await user.save();

    console.log(`\n✅ Password reset successful for "${username}"`);
    console.log(`   New password: ${newPassword}`);
    console.log(`   Password hash: ${hashedPassword.substring(0, 30)}...`);
    console.log(`\n🔐 You can now login with:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${newPassword}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

// Get username and password from command line
const username = process.argv[2];
const password = process.argv[3] || "12345";

if (!username) {
  console.log(`
Usage: node fix-password.js <username> [password]

Example:
  node fix-password.js admin 12345
  node fix-password.js john newpass123

If no password is provided, defaults to "12345"
  `);
  process.exit(1);
}

console.log(`🔧 Resetting password for "${username}" to "${password}"...`);
resetUserPassword(username, password);
