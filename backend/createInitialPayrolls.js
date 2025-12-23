import mongoose from "mongoose";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import SystemSettings from "./models/SystemSettings.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function createInitialPayrolls() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get system settings for base salaries
    const settings = await SystemSettings.findOne();
    if (!settings || !settings.baseSalary) {
      console.log("⚠️ No system settings found. Creating default base salaries...");
    }

    const baseSalaries = settings?.baseSalary || {
      admin: 15000,
      supervisor: 12000,
      teller: 10000
    };

    console.log("📊 Base Salaries:", baseSalaries);

    // Get all users
    const users = await User.find({ status: "approved" });
    console.log(`\n👥 Found ${users.length} approved users`);

    let created = 0;
    let skipped = 0;

    for (const user of users) {
      // Check if user already has a payroll entry
      const existingPayroll = await Payroll.findOne({ user: user._id });
      
      if (existingPayroll) {
        console.log(`⏭️  Skipping ${user.name} (${user.role}) - already has payroll`);
        skipped++;
        continue;
      }

      // Get base salary for this role
      const baseSalary = baseSalaries[user.role] || 0;

      // Create initial payroll entry
      const payroll = new Payroll({
        user: user._id,
        role: user.role,
        baseSalary: baseSalary,
        over: 0,
        short: 0,
        deduction: 0,
        withdrawal: 0,
        totalSalary: baseSalary,
        withdrawn: false,
        approved: true,
        createdAt: new Date()
      });

      await payroll.save();
      console.log(`✅ Created payroll for ${user.name} (${user.role}) - ₱${baseSalary}`);
      created++;

      // Update user's baseSalary if not set
      if (!user.baseSalary || user.baseSalary === 0) {
        user.baseSalary = baseSalary;
        await user.save();
        console.log(`   ↳ Updated user baseSalary to ₱${baseSalary}`);
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`🎉 Summary:`);
    console.log(`   Created: ${created} payroll entries`);
    console.log(`   Skipped: ${skipped} (already exist)`);
    console.log(`   Total: ${users.length} users`);
    console.log("=".repeat(50));

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

createInitialPayrolls();
