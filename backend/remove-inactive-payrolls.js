// Remove payrolls for users who haven't worked (no capital) this month
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import Capital from "./models/Capital.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function removeInactivePayrolls() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get all payrolls this month
    const payrolls = await Payroll.find({
      createdAt: { $gte: monthStart, $lte: monthEnd }
    }).populate('user');

    console.log(`\n📊 Checking ${payrolls.length} payrolls...\n`);

    let removed = 0;
    let kept = 0;

    for (const payroll of payrolls) {
      if (!payroll.user) {
        console.log(`⚠️ Orphaned payroll (no user): ${payroll._id}`);
        continue;
      }

      // Check if this user has any capital transactions this month
      const hasCapitalAsTeller = await Capital.findOne({
        tellerId: payroll.user._id,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      const hasCapitalAsSupervisor = await Capital.findOne({
        supervisorId: payroll.user._id,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      if (!hasCapitalAsTeller && !hasCapitalAsSupervisor) {
        console.log(`🗑️  Removing: ${payroll.user.username} (${payroll.user.role}) - No capital activity`);
        await Payroll.deleteOne({ _id: payroll._id });
        removed++;
      } else {
        console.log(`✓ Keeping: ${payroll.user.username} (${payroll.user.role}) - Has capital activity`);
        kept++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   Removed: ${removed}`);
    console.log(`   Kept: ${kept}`);
    console.log("=".repeat(50));

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

removeInactivePayrolls();
