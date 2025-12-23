import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import SystemSettings from "./models/SystemSettings.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller";

async function fixMariaSanta() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find Maria Santa
    const maria = await User.findOne({ 
      $or: [
        { name: /maria santa/i },
        { username: /maria.*santa/i }
      ]
    });

    if (!maria) {
      console.log("❌ Maria Santa not found");
      return;
    }

    console.log("\n" + "=".repeat(60));
    console.log("🔧 FIXING MARIA SANTA");
    console.log("=".repeat(60));
    console.log("Name:", maria.name);
    console.log("Role:", maria.role);
    console.log("Current Base Salary: ₱" + maria.baseSalary);

    // Get system settings
    const settings = await SystemSettings.findOne();
    // Use baseSalaries first (plural), fallback to baseSalary (singular)
    const supervisorBase = settings?.baseSalaries?.supervisor || settings?.baseSalary?.supervisor || 600;

    console.log("Expected Base Salary: ₱" + supervisorBase);

    if (maria.baseSalary !== supervisorBase) {
      console.log("\n⚠️  Base salary mismatch! Fixing...");
      
      // Update user base salary
      await User.findByIdAndUpdate(maria._id, { baseSalary: supervisorBase });
      console.log("✅ Updated user base salary to ₱" + supervisorBase);

      // Update today's payroll
      const today = new Date().toISOString().split('T')[0];
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const todayPayroll = await Payroll.findOne({
        user: maria._id,
        createdAt: { $gte: todayStart, $lte: todayEnd }
      });

      if (todayPayroll) {
        const oldTotal = todayPayroll.totalSalary;
        todayPayroll.baseSalary = supervisorBase;
        todayPayroll.role = 'supervisor';
        todayPayroll.totalSalary = supervisorBase - (todayPayroll.short || 0) + (todayPayroll.over || 0);
        
        // Add adjustments
        if (todayPayroll.adjustments && todayPayroll.adjustments.length > 0) {
          const adjustmentTotal = todayPayroll.adjustments.reduce((sum, adj) => sum + adj.delta, 0);
          todayPayroll.totalSalary += adjustmentTotal;
        }
        
        await todayPayroll.save();
        console.log(`✅ Updated today's payroll: ₱${oldTotal} → ₱${todayPayroll.totalSalary}`);
      } else {
        console.log("ℹ️  No payroll found for today");
      }
    } else {
      console.log("\n✅ Base salary is already correct!");
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ MARIA SANTA FIXED");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

fixMariaSanta();
