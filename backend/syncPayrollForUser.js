import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "./models/User.js";
import TellerReport from "./models/TellerReport.js";
import Payroll from "./models/Payroll.js";

async function syncPayrollForUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const username = "marhlien27";
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      console.log("❌ User not found:", username);
      process.exit(1);
    }

    console.log("📋 User found:", user.name || user.username);
    console.log("   User ID:", user._id);
    console.log("   Role:", user.role);
    console.log("   Base Salary:", user.baseSalary || 0);
    console.log("");

    // Find all teller reports for this user
    const reports = await TellerReport.find({ tellerId: user._id }).lean();
    console.log("📊 Found", reports.length, "teller reports");

    if (reports.length === 0) {
      console.log("⚠️ No teller reports found for this user");
      process.exit(0);
    }

    // Calculate totals
    const totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
    const totalShort = reports.reduce((sum, r) => sum + (Number(r.short) || 0), 0);

    console.log("   Total Over:", totalOver);
    console.log("   Total Short:", totalShort);
    console.log("");

    // Find or create payroll
    let payroll = await Payroll.findOne({ user: user._id });

    if (!payroll) {
      console.log("💰 Creating new payroll entry...");
      payroll = new Payroll({
        user: user._id,
        role: user.role,
        baseSalary: user.baseSalary || 0,
        over: totalOver,
        short: totalShort,
        deduction: 0,
        withdrawal: 0,
      });
    } else {
      console.log("💰 Updating existing payroll entry...");
      payroll.baseSalary = user.baseSalary || 0;
      payroll.over = totalOver;
      payroll.short = totalShort;
    }

    // Calculate total salary
    payroll.totalSalary = (payroll.baseSalary || 0) + 
                          (payroll.over || 0) - 
                          (payroll.short || 0) - 
                          (payroll.deduction || 0) - 
                          (payroll.withdrawal || 0);

    await payroll.save();

    console.log("✅ Payroll synced successfully!");
    console.log("   Base Salary:", payroll.baseSalary);
    console.log("   Over:", payroll.over);
    console.log("   Short:", payroll.short);
    console.log("   Deduction:", payroll.deduction);
    console.log("   Withdrawal:", payroll.withdrawal);
    console.log("   Total Salary:", payroll.totalSalary);
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

syncPayrollForUser();
