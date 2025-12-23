// Force sync Michelle's payroll with her report
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import TellerReport from "./models/TellerReport.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function syncMichellePayroll() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const michelle = await User.findOne({ username: { $regex: /michelle/i } });
    if (!michelle) {
      console.log("❌ Michelle not found");
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get all reports this month (use date field, not createdAt)
    const reports = await TellerReport.find({
      tellerId: michelle._id,
      date: { $gte: monthStart, $lte: monthEnd }
    });

    console.log(`\n📊 Michelle's reports this month: ${reports.length}`);
    reports.forEach(r => {
      console.log(`   ${r.date.toLocaleDateString()}: Over=₱${r.over}, Short=₱${r.short}`);
    });

    const totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
    const totalShort = reports.reduce((sum, r) => sum + (Number(r.short) || 0), 0);

    console.log(`\n📈 Totals: Over=₱${totalOver}, Short=₱${totalShort}`);

    // Update payroll
    let payroll = await Payroll.findOne({
      user: michelle._id,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    if (payroll) {
      payroll.over = totalOver;
      payroll.short = totalShort;
      payroll.totalSalary = (payroll.baseSalary || 0) + totalOver - totalShort - (payroll.deduction || 0) - (payroll.withdrawal || 0);
      await payroll.save();
      console.log(`\n✅ Updated Michelle's payroll:`);
      console.log(`   Base: ₱${payroll.baseSalary}`);
      console.log(`   Over: ₱${payroll.over}`);
      console.log(`   Short: ₱${payroll.short}`);
      console.log(`   Total: ₱${payroll.totalSalary}`);
    } else {
      console.log("⚠️ No payroll found for Michelle this month");
    }

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

syncMichellePayroll();
