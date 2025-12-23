import mongoose from "mongoose";
import dotenv from "dotenv";
import Payroll from "./models/Payroll.js";

dotenv.config();

/**
 * Clean up existing duplicate payroll entries by consolidating them
 * Keeps the oldest entry and removes duplicates
 */

async function cleanupDuplicatePayrolls() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const payrolls = await Payroll.find({})
      .sort({ createdAt: -1 });

    console.log(`📊 Total payroll entries: ${payrolls.length}\n`);

    // Group by user and month to find duplicates
    const userMonthMap = {};
    
    for (const payroll of payrolls) {
      const userId = payroll.user.toString();
      const monthKey = new Date(payroll.createdAt).toISOString().split('T')[0].substring(0, 7); // YYYY-MM
      const key = `${userId}|${monthKey}`;

      if (!userMonthMap[key]) {
        userMonthMap[key] = [];
      }

      userMonthMap[key].push(payroll);
    }

    let totalConsolidated = 0;
    let totalDeleted = 0;

    // Process each group
    for (const [key, entries] of Object.entries(userMonthMap)) {
      if (entries.length > 1) {
        const [userId, monthKey] = key.split('|');
        const username = entries[0].user?.username || "Unknown";
        const name = entries[0].user?.name || "Unknown";

        // Sort by createdAt to keep the oldest
        entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        const keepEntry = entries[0];
        const deleteEntries = entries.slice(1);

        console.log(`👤 User ID: ${userId} - ${monthKey}`);
        console.log(`   Consolidating ${entries.length} entries into ID: ${keepEntry._id.toString().slice(-8)}`);
        console.log(`   Base: ₱${keepEntry.baseSalary}, Over: ₱${keepEntry.over}, Short: ₱${keepEntry.short}`);

        // Delete the other entries
        for (const entry of deleteEntries) {
          await Payroll.deleteOne({ _id: entry._id });
          totalDeleted++;
          console.log(`   ✓ Deleted ID: ${entry._id.toString().slice(-8)}`);
        }

        totalConsolidated++;
        console.log("");
      }
    }

    console.log("\n✨ Cleanup Summary:");
    console.log(`   Users consolidated: ${totalConsolidated}`);
    console.log(`   Duplicate entries removed: ${totalDeleted}`);
    console.log("\n✅ Cleanup complete!");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

cleanupDuplicatePayrolls();
