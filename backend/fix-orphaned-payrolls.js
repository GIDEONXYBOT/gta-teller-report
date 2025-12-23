import mongoose from "mongoose";
import dotenv from "dotenv";
import Payroll from "./models/Payroll.js";
import User from "./models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function fixOrphanedPayrolls() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log("✅ Connected to MongoDB");

    // Get the problematic payrolls
    const zeroBasePayrolls = await Payroll.find({
      $or: [
        { baseSalary: { $exists: false } },
        { baseSalary: 0 }
      ]
    }).lean();

    console.log(`\n🚨 Found ${zeroBasePayrolls.length} payrolls with baseSalary = 0:`);
    zeroBasePayrolls.forEach(p => {
      console.log(`  ID: ${p._id}, User: ${p.user}, Role: ${p.role}, Date: ${p.date}`);
      console.log(`     Created: ${p.createdAt}, Total: ₱${p.totalSalary || 0}`);
    });

    let fixedCount = 0;

    for (const payroll of zeroBasePayrolls) {
      // Try to find the user by ID
      let user = null;
      if (payroll.user) {
        user = await User.findById(payroll.user).lean();
      }

      if (user) {
        // User exists, update payroll with user's baseSalary
        const userBaseSalary = user.baseSalary || 0;
        const newTotal = userBaseSalary + (payroll.over || 0) - (payroll.short || 0) - (payroll.deduction || 0) - (payroll.withdrawal || 0);

        await Payroll.findByIdAndUpdate(payroll._id, {
          $set: {
            baseSalary: userBaseSalary,
            totalSalary: newTotal
          }
        });

        console.log(`🔧 Fixed payroll for ${user.name || user.username}: base=₱${userBaseSalary}, total=₱${newTotal}`);
        fixedCount++;

      } else {
        // User doesn't exist, use role-based default
        const defaultBaseSalaries = {
          teller: 450,
          supervisor: 600,
          supervisor_teller: 600,
          admin: 0,
          super_admin: 0,
          head_watcher: 450,
          sub_watcher: 400,
          declarator: 450,
        };

        const role = payroll.role || 'teller';
        const defaultBase = defaultBaseSalaries[role] || 450;
        const newTotal = defaultBase + (payroll.over || 0) - (payroll.short || 0) - (payroll.deduction || 0) - (payroll.withdrawal || 0);

        await Payroll.findByIdAndUpdate(payroll._id, {
          $set: {
            baseSalary: defaultBase,
            totalSalary: newTotal
          }
        });

        console.log(`🔧 Fixed orphaned payroll (${role}): base=₱${defaultBase}, total=₱${newTotal}`);
        fixedCount++;
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} payrolls with zero base salary!`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

fixOrphanedPayrolls();