// Check which tellers have payroll but no capital transactions
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import Capital from "./models/Capital.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkPayrollsWithoutCapital() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get all payrolls this month
    const payrolls = await Payroll.find({
      createdAt: { $gte: monthStart, $lte: monthEnd }
    }).populate('user');

    console.log(`\n📊 Total payrolls this month: ${payrolls.length}\n`);

    let shouldNotHave = [];

    for (const payroll of payrolls) {
      if (!payroll.user) continue;

      // Check if this user has any capital transactions this month
      const hasCapitalAsTeller = await Capital.findOne({
        tellerId: payroll.user._id,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      const hasCapitalAsSupervisor = await Capital.findOne({
        supervisorId: payroll.user._id,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      if (!hasCapitalAsTeller && !hasCapitalAsSupervisor) {
        shouldNotHave.push({
          username: payroll.user.username,
          name: payroll.user.name,
          role: payroll.user.role,
          baseSalary: payroll.baseSalary,
          total: payroll.totalSalary,
          payrollId: payroll._id
        });
      }
    }

    console.log(`\n⚠️ ${shouldNotHave.length} users have payroll but NO capital transactions this month:\n`);
    shouldNotHave.forEach(u => {
      console.log(`   ${u.username} (${u.name}) - ${u.role}`);
      console.log(`      Base: ₱${u.baseSalary}, Total: ₱${u.total}`);
      console.log(`      Payroll ID: ${u.payrollId}\n`);
    });

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

checkPayrollsWithoutCapital();
