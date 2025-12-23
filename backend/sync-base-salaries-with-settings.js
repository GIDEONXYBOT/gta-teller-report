// Sync all user base salaries with admin settings
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import SystemSettings from "./models/SystemSettings.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function syncAllBaseSalariesWithSettings() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get system settings for base salaries
    const settings = await SystemSettings.findOne();
    if (!settings || !settings.baseSalary) {
      console.log("❌ No system settings found. Please configure base salaries in Admin Settings first.");
      return;
    }

    const baseSalaryConfig = settings.baseSalary;

    console.log("💰 Admin Settings Base Salary Configuration:");
    Object.entries(baseSalaryConfig).forEach(([role, salary]) => {
      console.log(`   ${role}: ₱${salary}`);
    });
    console.log("");

    // Get all active users
    const users = await User.find({ 
      status: "approved",
      role: { $in: ["admin", "supervisor", "teller", "assistantAdmin", "declarator", "watcher", "supervisor_teller"] }
    });

    console.log(`👥 Found ${users.length} active users to sync\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // Current month range for payroll updates
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    for (const user of users) {
      try {
        // Map user role to salary config key
        let salaryKey = user.role;
        if (user.role === 'supervisor_teller') {
          salaryKey = 'supervisor'; // supervisor_teller uses supervisor salary
        }

        const adminBaseSalary = baseSalaryConfig[salaryKey];
        
        if (!adminBaseSalary && adminBaseSalary !== 0) {
          console.log(`⚠️ No base salary configured for role: ${user.role} (${user.username})`);
          skipped++;
          continue;
        }

        const currentBaseSalary = user.baseSalary || 0;
        
        // Check if update is needed
        if (currentBaseSalary !== adminBaseSalary) {
          console.log(`🔄 ${user.username} (${user.role}):`);
          console.log(`   Current: ₱${currentBaseSalary} → Admin Setting: ₱${adminBaseSalary}`);
          
          // Update user base salary
          user.baseSalary = adminBaseSalary;
          await user.save();
          
          // Update their payroll if exists this month
          const payroll = await Payroll.findOne({
            user: user._id,
            createdAt: { $gte: monthStart, $lte: monthEnd }
          });
          
          if (payroll) {
            const oldTotal = payroll.totalSalary || 0;
            payroll.baseSalary = adminBaseSalary;
            payroll.totalSalary = adminBaseSalary + (payroll.over || 0) - (payroll.short || 0) - (payroll.deduction || 0) - (payroll.withdrawal || 0);
            await payroll.save();
            console.log(`   ✅ Updated payroll: ₱${oldTotal} → ₱${payroll.totalSalary}`);
          } else {
            console.log(`   ⚠️ No payroll found for this month`);
          }
          
          updated++;
        } else {
          console.log(`✅ ${user.username} (${user.role}): Already synced with admin settings (₱${adminBaseSalary})`);
          skipped++;
        }
        
      } catch (error) {
        console.error(`❌ Error updating ${user.username}:`, error.message);
        errors++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 SYNC COMPLETE");
    console.log("=".repeat(50));
    console.log(`✅ Updated: ${updated} users`);
    console.log(`⏭️ Skipped: ${skipped} users`);
    console.log(`❌ Errors: ${errors} users`);
    
    if (updated > 0) {
      console.log("\n🎉 All user base salaries are now synced with admin settings!");
    }

    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error.message);
    process.exit(1);
  }
}

syncAllBaseSalariesWithSettings();