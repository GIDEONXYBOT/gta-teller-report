import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "./models/User.js";
import TellerReport from "./models/TellerReport.js";
import Payroll from "./models/Payroll.js";

async function syncSupervisorPayroll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const username = "marhlien27";
    
    // Find supervisor
    const supervisor = await User.findOne({ username });
    if (!supervisor) {
      console.log("❌ User not found:", username);
      process.exit(1);
    }

    console.log("📋 Supervisor found:", supervisor.name || supervisor.username);
    console.log("   User ID:", supervisor._id);
    console.log("   Role:", supervisor.role);
    console.log("   Base Salary:", supervisor.baseSalary || 0);
    console.log("");

    // Find all tellers assigned to this supervisor
    const tellers = await User.find({ supervisorId: supervisor._id, role: "teller" }).lean();
    console.log("👥 Found", tellers.length, "assigned tellers");

    if (tellers.length === 0) {
      console.log("⚠️  No tellers assigned to this supervisor");
      console.log("💡 Supervisors earn money from their tellers' performance");
    }

    let totalOver = 0;
    let totalShort = 0;
    let totalReports = 0;

    for (const teller of tellers) {
      const reports = await TellerReport.find({ tellerId: teller._id }).lean();
      console.log(`   - ${teller.name}: ${reports.length} reports`);
      
      reports.forEach(r => {
        totalOver += Number(r.over) || 0;
        totalShort += Number(r.short) || 0;
        totalReports++;
      });
    }

    console.log("");
    console.log("📊 Total from all assigned tellers:");
    console.log("   Reports:", totalReports);
    console.log("   Total Over:", totalOver);
    console.log("   Total Short:", totalShort);
    console.log("");

    // Find or create payroll
    let payroll = await Payroll.findOne({ user: supervisor._id });

    if (!payroll) {
      console.log("💰 Creating new payroll entry...");
      payroll = new Payroll({
        user: supervisor._id,
        role: supervisor.role,
        baseSalary: supervisor.baseSalary || 0,
        over: totalOver,
        short: totalShort,
        deduction: 0,
        withdrawal: 0,
      });
    } else {
      console.log("💰 Updating existing payroll entry...");
      payroll.baseSalary = supervisor.baseSalary || 0;
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

syncSupervisorPayroll();
