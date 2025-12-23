import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function updateExistingUsersBaseSalary() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log("✅ Connected to MongoDB");

    const defaultBaseSalaries = {
      teller: 450,
      supervisor: 600,
      supervisor_teller: 600,
      admin: 0,
      super_admin: 0,
      head_watcher: 450,
      sub_watcher: 400,
      declarator: 450,
    };

    // Find all users with baseSalary = 0 or undefined
    const usersToUpdate = await User.find({
      $or: [
        { baseSalary: { $exists: false } },
        { baseSalary: 0 }
      ]
    }).select("username name role baseSalary").lean();

    console.log(`\n👥 Found ${usersToUpdate.length} users needing baseSalary updates`);

    let updatedCount = 0;

    for (const user of usersToUpdate) {
      const expectedBaseSalary = defaultBaseSalaries[user.role] || 450;

      // Use the model's save method to trigger the pre-save hook
      const userDoc = await User.findById(user._id);
      userDoc.baseSalary = expectedBaseSalary; // This will be overridden by the pre-save hook, but we set it to trigger the logic
      await userDoc.save();

      console.log(`🔧 Updated ${user.name || user.username} (${user.role}): baseSalary set to ₱${expectedBaseSalary}`);
      updatedCount++;
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY:");
    console.log("=".repeat(60));
    console.log(`🔧 Updated users: ${updatedCount}`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

updateExistingUsersBaseSalary();