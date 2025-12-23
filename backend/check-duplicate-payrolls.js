// Check for duplicate supervisor payrolls
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkDuplicatePayrolls() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Find all supervisors
    const supervisors = await User.find({
      role: { $in: ["supervisor", "supervisor_teller"] }
    });

    console.log(`\n👥 Checking ${supervisors.length} supervisors...\n`);

    let hasDuplicates = false;

    for (const supervisor of supervisors) {
      const payrolls = await Payroll.find({
        user: supervisor._id,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      if (payrolls.length > 1) {
        console.log(`⚠️ DUPLICATE: ${supervisor.username} has ${payrolls.length} payrolls!`);
        payrolls.forEach((p, idx) => {
          console.log(`   ${idx + 1}. ID: ${p._id}, Created: ${p.createdAt.toLocaleString()}, Total: ₱${p.totalSalary}`);
        });
        console.log();
        hasDuplicates = true;
      } else if (payrolls.length === 1) {
        console.log(`✓ ${supervisor.username}: 1 payroll (₱${payrolls[0].totalSalary})`);
      } else {
        console.log(`○ ${supervisor.username}: No payroll`);
      }
    }

    if (hasDuplicates) {
      console.log("\n⚠️ Found duplicate payrolls! Would you like to remove duplicates? (Keep the most recent one)");
    } else {
      console.log("\n✅ No duplicate payrolls found!");
    }

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

checkDuplicatePayrolls();
