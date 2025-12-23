import mongoose from "mongoose";
import dotenv from "dotenv";
import Payroll from "./models/Payroll.js";
import User from "./models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function fixExistingPayrollsBaseSalary() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log("✅ Connected to MongoDB");

    // Find payrolls with baseSalary = 0
    const payrollsToFix = await Payroll.find({
      $or: [
        { baseSalary: { $exists: false } },
        { baseSalary: 0 }
      ]
    }).populate('user', 'username name baseSalary').lean();

    console.log(`\n📊 Found ${payrollsToFix.length} payrolls with baseSalary = 0`);

    let updatedCount = 0;

    for (const payroll of payrollsToFix) {
      if (!payroll.user || !payroll.user.baseSalary) {
        console.log(`⚠️ Skipping payroll ${payroll._id} - no user or user has no baseSalary`);
        continue;
      }

      const userBaseSalary = payroll.user.baseSalary;
      const oldTotal = payroll.totalSalary || 0;

      // Update payroll baseSalary and recalculate totalSalary
      const newTotal = userBaseSalary + (payroll.over || 0) - (payroll.short || 0) - (payroll.deduction || 0) - (payroll.withdrawal || 0);

      await Payroll.findByIdAndUpdate(payroll._id, {
        $set: {
          baseSalary: userBaseSalary,
          totalSalary: newTotal
        }
      });

      console.log(`🔧 Updated payroll for ${payroll.user.name || payroll.user.username}: base=₱${userBaseSalary}, total=₱${oldTotal} → ₱${newTotal}`);
      updatedCount++;
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY:");
    console.log("=".repeat(60));
    console.log(`🔧 Updated payrolls: ${updatedCount}`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

fixExistingPayrollsBaseSalary();