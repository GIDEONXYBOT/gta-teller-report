import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import SystemSettings from "./models/SystemSettings.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller";

async function setBaseSalariesForAllUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get system settings for default base salaries
    const settings = await SystemSettings.findOne().lean();
    const defaultBaseSalaries = {
      teller: settings?.baseSalaries?.teller || settings?.baseSalary?.teller || 450,
      supervisor: settings?.baseSalaries?.supervisor || settings?.baseSalary?.supervisor || 600,
      supervisor_teller: settings?.baseSalaries?.supervisor_teller || settings?.baseSalary?.supervisor || 600,
      admin: settings?.baseSalaries?.admin || settings?.baseSalary?.admin || 0,
      super_admin: settings?.baseSalaries?.admin || settings?.baseSalary?.admin || 0,
      head_watcher: settings?.baseSalaries?.head_watcher || settings?.baseSalary?.head_watcher || 450,
      sub_watcher: settings?.baseSalaries?.sub_watcher || settings?.baseSalary?.sub_watcher || 400,
      declarator: settings?.baseSalaries?.teller || settings?.baseSalary?.teller || 450, // Same as teller
    };

    console.log("\n📋 Default Base Salaries:", defaultBaseSalaries);

    // Get all users
    const users = await User.find({}).select("username name role baseSalary").lean();
    console.log(`\n👥 Found ${users.length} users`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const currentBaseSalary = user.baseSalary || 0;
      const expectedBaseSalary = defaultBaseSalaries[user.role] || 450;

      if (currentBaseSalary === 0 || currentBaseSalary !== expectedBaseSalary) {
        // Update the user's baseSalary
        await User.findByIdAndUpdate(user._id, { $set: { baseSalary: expectedBaseSalary } });
        console.log(`🔧 Updated ${user.name || user.username} (${user.role}): ₱${currentBaseSalary} → ₱${expectedBaseSalary}`);
        updatedCount++;
      } else {
        console.log(`✓ ${user.name || user.username} (${user.role}) already has correct base salary: ₱${currentBaseSalary}`);
        skippedCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY:");
    console.log("=".repeat(60));
    console.log(`🔧 Updated users: ${updatedCount}`);
    console.log(`✓  Skipped users: ${skippedCount}`);
    console.log(`📝 Total processed: ${users.length}`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

setBaseSalariesForAllUsers();