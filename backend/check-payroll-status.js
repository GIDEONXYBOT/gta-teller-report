import mongoose from "mongoose";
import dotenv from "dotenv";
import Payroll from "./models/Payroll.js";
import User from "./models/User.js"; // Import User model to register it

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkPayrollStatus() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log("✅ Connected to MongoDB");

    // Check total payrolls
    const totalPayrolls = await Payroll.countDocuments();
    console.log(`📊 Total payrolls in database: ${totalPayrolls}`);

    if (totalPayrolls === 0) {
      console.log('⚠️  No payrolls found in the database!');
      return;
    }

    // Check most recent payrolls regardless of date
    const allPayrolls = await Payroll.find({}).populate('user', 'username name role baseSalary').sort({ createdAt: -1 }).limit(15).lean();
    console.log(`\n🕐 Most recent payrolls (all time, ${allPayrolls.length} shown):`);
    allPayrolls.forEach(p => {
      const date = new Date(p.createdAt).toISOString().split('T')[0] + ' ' + new Date(p.createdAt).toISOString().split('T')[1].split('.')[0];
      const userName = p.user ? (p.user.name || p.user.username) : 'Unknown';
      const userBaseSalary = p.user ? (p.user.baseSalary || 0) : 0;
      const payrollBaseSalary = p.baseSalary || 0;
      const status = payrollBaseSalary === 0 ? '❌ ZERO' : '✅ OK';
      console.log(`  ${date}: ${userName} - Payroll Base: ₱${payrollBaseSalary}, User Base: ₱${userBaseSalary} ${status}`);
    });

    // Check for payrolls with zero base salary
    const zeroBasePayrolls = await Payroll.find({
      $or: [
        { baseSalary: { $exists: false } },
        { baseSalary: 0 }
      ]
    }).populate('user', 'username name role baseSalary').sort({ createdAt: -1 }).limit(10).lean();

    if (zeroBasePayrolls.length > 0) {
      console.log(`\n🚨 CRITICAL: ${zeroBasePayrolls.length} payrolls still have baseSalary = 0:`);
      zeroBasePayrolls.forEach(p => {
        const date = new Date(p.createdAt).toISOString().split('T')[0];
        const userName = p.user ? (p.user.name || p.user.username) : 'Unknown';
        console.log(`  ❌ ${date}: ${userName} - Base: ₱${p.baseSalary || 0}`);
      });
    } else {
      console.log(`\n✅ All payrolls have proper base salaries!`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

checkPayrollStatus();