// Check user base salaries and update payrolls
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkAndFixSalaries() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check Apple and Erika specifically
    const apple = await User.findOne({ username: "apple" });
    const erika = await User.findOne({ username: "006erika" });

    console.log("\n👤 User Base Salaries:");
    console.log(`Apple (${apple?.role}): ₱${apple?.baseSalary || 0}`);
    console.log(`Erika (${erika?.role}): ₱${erika?.baseSalary || 0}`);

    // Check their current month payrolls
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const applePayroll = await Payroll.findOne({
      user: apple._id,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    const erikaPayroll = await Payroll.findOne({
      user: erika._id,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    console.log("\n💰 Current Payroll Records:");
    console.log(`Apple: Base=₱${applePayroll?.baseSalary || 0}, Total=₱${applePayroll?.totalSalary || 0}`);
    console.log(`Erika: Base=₱${erikaPayroll?.baseSalary || 0}, Total=₱${erikaPayroll?.totalSalary || 0}`);

    // Update if needed
    let updated = 0;
    if (applePayroll && apple.baseSalary && applePayroll.baseSalary !== apple.baseSalary) {
      applePayroll.baseSalary = apple.baseSalary;
      applePayroll.totalSalary = apple.baseSalary + (applePayroll.over || 0) - (applePayroll.short || 0) - (applePayroll.deduction || 0) - (applePayroll.withdrawal || 0);
      await applePayroll.save();
      console.log(`✅ Updated Apple's payroll to ₱${apple.baseSalary}`);
      updated++;
    }

    if (erikaPayroll && erika.baseSalary && erikaPayroll.baseSalary !== erika.baseSalary) {
      erikaPayroll.baseSalary = erika.baseSalary;
      erikaPayroll.totalSalary = erika.baseSalary + (erikaPayroll.over || 0) - (erikaPayroll.short || 0) - (erikaPayroll.deduction || 0) - (erikaPayroll.withdrawal || 0);
      await erikaPayroll.save();
      console.log(`✅ Updated Erika's payroll to ₱${erika.baseSalary}`);
      updated++;
    }

    console.log(`\n📊 Updated ${updated} payroll records`);

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

checkAndFixSalaries();
