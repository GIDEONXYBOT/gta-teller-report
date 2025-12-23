// Add Michelle's report for yesterday
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import TellerReport from "./models/TellerReport.js";
import Capital from "./models/Capital.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function addMichelleReport() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find Michelle and Marhlien
    const michelle = await User.findOne({ username: { $regex: /michelle/i } });
    const marhlien = await User.findOne({ username: { $regex: /marhlien/i } });

    if (!michelle) {
      console.log("❌ Michelle not found");
      return;
    }

    if (!marhlien) {
      console.log("❌ Marhlien not found");
      return;
    }

    console.log(`\n👤 Michelle: ${michelle.username} (${michelle._id})`);
    console.log(`👤 Marhlien: ${marhlien.username} (${marhlien._id})\n`);

    // Check Michelle's capital transactions
    const capitals = await Capital.find({ tellerId: michelle._id }).sort({ createdAt: -1 });
    console.log(`💰 Michelle has ${capitals.length} capital transaction(s)\n`);

    // Yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    console.log(`📅 Yesterday: ${yesterday.toLocaleDateString()}\n`);

    // Check if report already exists for yesterday
    const existingReport = await TellerReport.findOne({
      tellerId: michelle._id,
      date: { $gte: yesterday, $lte: yesterdayEnd }
    });

    if (existingReport) {
      console.log("⚠️ Report already exists for yesterday. Updating...");
      existingReport.over = 26;
      existingReport.supervisorId = marhlien._id;
      existingReport.supervisorName = marhlien.name || marhlien.username;
      await existingReport.save();
      console.log("✅ Updated existing report with over = 26");
    } else {
      // Create new report for yesterday
      const report = await TellerReport.create({
        tellerId: michelle._id,
        tellerName: michelle.name || michelle.username,
        supervisorId: marhlien._id,
        supervisorName: marhlien.name || marhlien.username,
        systemBalance: 10000,
        cashOnHand: 10026,
        short: 0,
        over: 26,
        d1000: 10,
        d500: 0,
        d200: 0,
        d100: 0,
        d50: 0,
        d20: 1,
        coins: 6,
        date: yesterday,
        createdAt: yesterday,
        status: "pending"
      });

      console.log("✅ Created report for Michelle:");
      console.log(`   Date: ${report.date.toLocaleString()}`);
      console.log(`   Over: ₱${report.over}`);
      console.log(`   Supervisor: ${report.supervisorName}`);
    }

    // Sync Michelle's payroll
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const reports = await TellerReport.find({
      tellerId: michelle._id,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    const totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
    const totalShort = reports.reduce((sum, r) => sum + (Number(r.short) || 0), 0);

    console.log(`\n📊 Michelle's month summary:`);
    console.log(`   Reports: ${reports.length}`);
    console.log(`   Total Over: ₱${totalOver}`);
    console.log(`   Total Short: ₱${totalShort}`);

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

addMichelleReport();
