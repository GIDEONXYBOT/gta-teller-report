// Check Michelle's data
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Capital from "./models/Capital.js";
import TellerReport from "./models/TellerReport.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkMichelle() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const michelle = await User.findOne({ username: { $regex: /michelle/i } });
    if (!michelle) {
      console.log("❌ Michelle not found");
      return;
    }

    console.log(`\n👤 Michelle: ${michelle.username} (${michelle._id})\n`);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Check capital transactions
    const capitals = await Capital.find({
      tellerId: michelle._id,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    console.log(`💰 Capital transactions this month: ${capitals.length}`);

    // Check teller reports
    const reports = await TellerReport.find({
      tellerId: michelle._id,
      $or: [
        { date: { $gte: monthStart, $lte: monthEnd } },
        { createdAt: { $gte: monthStart, $lte: monthEnd } }
      ]
    });

    console.log(`📊 Teller reports this month: ${reports.length}`);
    reports.forEach(r => {
      console.log(`   Date: ${r.date ? new Date(r.date).toLocaleDateString() : 'N/A'}`);
      console.log(`   Created: ${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}`);
      console.log(`   Over: ₱${r.over}`);
    });

    console.log("\n💡 Decision: Michelle HAS teller reports, so she SHOULD have a payroll entry!");

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

checkMichelle();
