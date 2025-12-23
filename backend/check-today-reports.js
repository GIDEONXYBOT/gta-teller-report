// Check today's teller reports
import mongoose from "mongoose";
import dotenv from "dotenv";
import TellerReport from "./models/TellerReport.js";
import User from "./models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkTodayReports() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    console.log(`📅 Checking reports for ${today.toLocaleDateString()}\n`);

    const reports = await TellerReport.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    console.log(`📊 Found ${reports.length} teller reports today\n`);

    for (const report of reports) {
      const teller = await User.findById(report.tellerId).lean();
      console.log(`👤 ${teller?.username || 'Unknown'}`);
      console.log(`   Over: ₱${report.over || 0}`);
      console.log(`   Short: ₱${report.short || 0}`);
      console.log(`   Status: ${report.status || 'pending'}`);
      console.log(`   Date: ${report.date}\n`);
    }

    // Also check this month's reports
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const monthReports = await TellerReport.find({
      date: { $gte: monthStart, $lte: monthEnd }
    }).lean();

    console.log(`📊 Total reports this month: ${monthReports.length}\n`);

    const tellerStats = {};
    for (const report of monthReports) {
      const tellerId = report.tellerId.toString();
      if (!tellerStats[tellerId]) {
        tellerStats[tellerId] = { over: 0, short: 0, count: 0, name: '' };
      }
      tellerStats[tellerId].over += Number(report.over) || 0;
      tellerStats[tellerId].short += Number(report.short) || 0;
      tellerStats[tellerId].count += 1;
    }

    console.log("📈 Month Summary by Teller:");
    for (const [tellerId, stats] of Object.entries(tellerStats)) {
      const teller = await User.findById(tellerId).lean();
      console.log(`   ${teller?.username || tellerId}: ${stats.count} reports, Over: ₱${stats.over}, Short: ₱${stats.short}`);
    }

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

checkTodayReports();
