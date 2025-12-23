import mongoose from "mongoose";
import dotenv from "dotenv";
import Payroll from "./models/Payroll.js";
import User from "./models/User.js";

dotenv.config();

/**
 * Check for duplicate/multiple payroll entries per user in same date range
 * This helps identify if the "over merging" issue is caused by multiple payroll records
 */

async function checkPayrollDuplicates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("🔍 Checking for duplicate/multiple payroll entries...\n");

    // Get all payrolls
    const payrolls = await Payroll.find({})
      .populate("user", "name username role baseSalary")
      .sort({ createdAt: -1 })
      .lean();

    console.log(`📊 Total payroll entries: ${payrolls.length}\n`);

    // Group by user and date to find duplicates
    const userDateMap = {};
    const duplicates = [];

    for (const payroll of payrolls) {
      if (!payroll.user) continue;

      const userId = payroll.user._id.toString();
      const dateKey = new Date(payroll.createdAt).toISOString().split('T')[0];
      const monthKey = new Date(payroll.createdAt).toISOString().split('T')[0].substring(0, 7); // YYYY-MM

      const key = `${userId}|${monthKey}`;

      if (!userDateMap[key]) {
        userDateMap[key] = [];
      }

      userDateMap[key].push({
        _id: payroll._id.toString(),
        date: dateKey,
        baseSalary: payroll.baseSalary || 0,
        over: payroll.over || 0,
        short: payroll.short || 0,
        totalSalary: payroll.totalSalary || 0,
        createdAt: new Date(payroll.createdAt).toLocaleString(),
      });
    }

    // Find entries with multiple payrolls in same month
    for (const [key, entries] of Object.entries(userDateMap)) {
      if (entries.length > 1) {
        const [userId, monthKey] = key.split('|');
        const user = payrolls.find(p => p.user._id.toString() === userId)?.user;
        
        duplicates.push({
          userId,
          username: user?.username || "Unknown",
          name: user?.name || "Unknown",
          month: monthKey,
          count: entries.length,
          entries,
        });
      }
    }

    if (duplicates.length === 0) {
      console.log("✅ No duplicate payroll entries found in same month.\n");
      console.log("📌 This suggests the 'merging' issue may be from:");
      console.log("   1. Repeated sync calls accumulating reports");
      console.log("   2. Previous over amounts not being cleared properly");
      console.log("   3. Frontend caching old data");
    } else {
      console.log(`⚠️  Found ${duplicates.length} users with duplicate payroll entries:\n`);
      
      for (const dup of duplicates) {
        console.log(`👤 ${dup.username} (${dup.name}) - ${dup.month}`);
        console.log(`   Count: ${dup.count} entries`);
        
        for (const entry of dup.entries) {
          console.log(`   📋 ID: ${entry._id.slice(-8)}`);
          console.log(`      Date: ${entry.date}`);
          console.log(`      Base: ₱${entry.baseSalary}, Over: ₱${entry.over}, Short: ₱${entry.short}`);
          console.log(`      Total: ₱${entry.totalSalary}`);
          console.log(`      Created: ${entry.createdAt}`);
        }
        console.log("");
      }

      console.log("🔧 RECOMMENDATION:");
      console.log("   Use merge-all-duplicate-payrolls.js script to consolidate these entries.");
      console.log("   This will keep the oldest entry and merge values from all others.\n");
    }

    // Check for over amounts that seem inflated
    console.log("\n📈 Checking for suspiciously high 'over' amounts...\n");
    
    const suspiciousOvers = payrolls.filter(p => {
      const over = p.over || 0;
      return over > 5000; // Anything over 5000 in a month is suspicious
    });

    if (suspiciousOvers.length > 0) {
      console.log(`⚠️  Found ${suspiciousOvers.length} entries with over > ₱5000:\n`);
      for (const p of suspiciousOvers) {
        const user = p.user?.name || p.user?.username || "Unknown";
        const month = new Date(p.createdAt).toISOString().split('T')[0].substring(0, 7);
        console.log(`${user} (${month}): ₱${p.over}`);
      }
    } else {
      console.log("✅ All 'over' amounts seem reasonable (< ₱5000).\n");
    }

    console.log("✨ Diagnostics complete.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

checkPayrollDuplicates();
