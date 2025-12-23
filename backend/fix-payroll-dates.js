// Update payroll dates to match first capital transaction date
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import Capital from "./models/Capital.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function fixPayrollDates() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get all payrolls for this month
    const payrolls = await Payroll.find({
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    console.log(`📊 Found ${payrolls.length} payroll records this month\n`);

    let updated = 0;

    for (const payroll of payrolls) {
      const user = await User.findById(payroll.user);
      if (!user) continue;

      // Find their first capital transaction this month
      const firstCapital = await Capital.findOne({
        $or: [
          { tellerId: user._id },
          { supervisorId: user._id }
        ],
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }).sort({ createdAt: 1 });

      if (firstCapital) {
        const capitalDate = new Date(firstCapital.createdAt);
        const payrollDate = new Date(payroll.createdAt);

        // If payroll was created before the capital transaction, update it
        if (payrollDate < capitalDate) {
          console.log(`🔄 ${user.username}:`);
          console.log(`   Payroll created: ${payrollDate.toLocaleString()}`);
          console.log(`   First capital: ${capitalDate.toLocaleString()}`);
          
          payroll.createdAt = capitalDate;
          await payroll.save();
          
          console.log(`   ✅ Updated to: ${capitalDate.toLocaleString()}\n`);
          updated++;
        }
      }
    }

    console.log("=".repeat(50));
    console.log(`📊 Updated ${updated} payroll dates`);
    console.log("=".repeat(50));

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

fixPayrollDates();
