import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";

async function fixSupervisorPayroll() {
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

    // Find or create payroll
    let payroll = await Payroll.findOne({ user: supervisor._id });

    if (!payroll) {
      console.log("💰 Creating new payroll entry...");
      payroll = new Payroll({
        user: supervisor._id,
        role: supervisor.role,
        baseSalary: supervisor.baseSalary || 0,
        over: 0, // Supervisors don't get over
        short: 0, // Supervisors don't get short
        deduction: 0,
        withdrawal: 0,
      });
    } else {
      console.log("💰 Updating existing payroll entry...");
      payroll.baseSalary = supervisor.baseSalary || 0;
      payroll.over = 0; // Reset over
      payroll.short = 0; // Reset short
    }

    // For supervisors and admins: totalSalary = baseSalary - deduction - withdrawal
    payroll.totalSalary = (payroll.baseSalary || 0) - 
                          (payroll.deduction || 0) - 
                          (payroll.withdrawal || 0);

    await payroll.save();

    console.log("✅ Payroll fixed successfully!");
    console.log("   Base Salary:", payroll.baseSalary);
    console.log("   Over:", payroll.over);
    console.log("   Short:", payroll.short);
    console.log("   Deduction:", payroll.deduction);
    console.log("   Withdrawal:", payroll.withdrawal);
    console.log("   Total Salary:", payroll.totalSalary);
    console.log("");
    console.log("💡 Supervisors only receive base salary, no over/short bonuses");
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

fixSupervisorPayroll();
