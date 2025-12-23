import mongoose from "mongoose";
import dotenv from "dotenv";
import Payroll from "./models/Payroll.js";
import User from "./models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkTodaysPayrolls() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log("✅ Connected to MongoDB");

    // Check for payrolls created today (November 27, 2025)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    const today = new Date(year, month, day);
    const tomorrow = new Date(year, month, day + 1);

    const timezoneOffset = now.getTimezoneOffset();
    const offsetHours = timezoneOffset / 60;

    const todayStartUTC = new Date(today.getTime() - (offsetHours * 60 * 60 * 1000));
    const todayEndUTC = new Date(tomorrow.getTime() - (offsetHours * 60 * 60 * 1000));

    console.log(`📅 Checking payrolls created today: ${today.toLocaleDateString()}`);
    console.log(`📅 UTC range: ${todayStartUTC.toISOString()} to ${todayEndUTC.toISOString()}`);

    const todaysPayrolls = await Payroll.find({
      createdAt: { $gte: todayStartUTC, $lt: todayEndUTC }
    }).populate('user', 'username name role baseSalary').sort({ createdAt: -1 }).lean();

    console.log(`\n📋 Payrolls created today: ${todaysPayrolls.length}`);
    if (todaysPayrolls.length > 0) {
      todaysPayrolls.forEach((p, i) => {
        const time = new Date(p.createdAt).toISOString().split('T')[1].split('.')[0];
        const userName = p.user ? (p.user.name || p.user.username) : 'Unknown';
        const baseSalary = p.user ? (p.user.baseSalary || 0) : 0;
        const status = baseSalary === 0 ? '❌ ZERO BASE' : '✅ OK';
        console.log(`${i+1}. ${time} - ${userName} (₱${baseSalary}) - Total: ₱${p.totalSalary || 0} ${status}`);
      });

      // Check if any payrolls have zero base salary
      const zeroBasePayrolls = todaysPayrolls.filter(p => (p.baseSalary || 0) === 0);
      if (zeroBasePayrolls.length > 0) {
        console.log(`\n🚨 CRITICAL: ${zeroBasePayrolls.length} payrolls created today have ZERO base salary!`);
      } else {
        console.log(`\n✅ All payrolls created today have proper base salaries!`);
      }
    } else {
      console.log('📭 No payrolls created today.');
    }

    // Check total payrolls
    const totalPayrolls = await Payroll.countDocuments();
    console.log(`\n📊 Total payrolls in system: ${totalPayrolls}`);

    // Check most recent payrolls
    const recentPayrolls = await Payroll.find({}).populate('user', 'username name role baseSalary').sort({ createdAt: -1 }).limit(5).lean();
    console.log(`\n🕐 Most recent payrolls:`);
    recentPayrolls.forEach((p, i) => {
      const date = new Date(p.createdAt).toISOString().split('T')[0];
      const time = new Date(p.createdAt).toISOString().split('T')[1].split('.')[0];
      const userName = p.user ? (p.user.name || p.user.username) : 'Unknown';
      const baseSalary = p.user ? (p.user.baseSalary || 0) : 0;
      console.log(`${i+1}. ${date} ${time} - ${userName} (₱${baseSalary}) - Total: ₱${p.totalSalary || 0}`);
    });

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

checkTodaysPayrolls();