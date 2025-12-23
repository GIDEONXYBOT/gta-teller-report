// Force update all salaries to match admin settings
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import SystemSettings from "./models/SystemSettings.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function forceUpdateSalaries() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get salary settings from admin configuration
    const settings = await SystemSettings.findOne();
    const salaryConfig = settings?.baseSalary || {
      admin: 1000,
      assistantAdmin: 600,
      supervisor: 600,
      declarator: 600,
      watcher: 500,
      teller: 450
    };

    console.log("\n💰 Admin Salary Configuration:");
    console.log(`   Supervisor: ₱${salaryConfig.supervisor}`);
    console.log(`   Teller: ₱${salaryConfig.teller}`);
    console.log(`   Admin: ₱${salaryConfig.admin}`);
    console.log(`   Assistant Admin: ₱${salaryConfig.assistantAdmin}\n`);

    // Get ALL users (not just those with 0 salary)
    const users = await User.find({
      role: { $in: ["teller", "supervisor", "supervisor_teller", "admin", "assistantAdmin"] }
    });

    console.log(`👥 Found ${users.length} users to update\n`);

    let updated = 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    for (const user of users) {
      // Map role to salary config key
      let salaryKey = user.role;
      if (user.role === 'supervisor_teller') {
        salaryKey = 'supervisor'; // supervisor_teller uses supervisor salary
      }
      
      const correctSalary = salaryConfig[salaryKey] || 0;
      
      if (user.baseSalary !== correctSalary) {
        console.log(`Updating ${user.username} (${user.role}): ₱${user.baseSalary || 0} → ₱${correctSalary}`);
        
        // Update user base salary
        user.baseSalary = correctSalary;
        await user.save();
        
        // Update their payroll if exists this month
        const payroll = await Payroll.findOne({
          user: user._id,
          createdAt: { $gte: monthStart, $lte: monthEnd }
        });
        
        if (payroll) {
          payroll.baseSalary = correctSalary;
          payroll.totalSalary = correctSalary + (payroll.over || 0) - (payroll.short || 0) - (payroll.deduction || 0) - (payroll.withdrawal || 0);
          await payroll.save();
          console.log(`  ✅ Updated payroll: Total now ₱${payroll.totalSalary}`);
        } else {
          console.log(`  ⚠️ No payroll found for this month`);
        }
        
        updated++;
      } else {
        console.log(`✓ ${user.username} already has correct salary (₱${correctSalary})`);
      }
    }

    console.log(`\n📊 Updated ${updated} users`);

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

forceUpdateSalaries();
