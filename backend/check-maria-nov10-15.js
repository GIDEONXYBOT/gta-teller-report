import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import Capital from "./models/Capital.js";
import Shift from "./models/Shift.js";
import SystemSettings from "./models/SystemSettings.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller";

async function checkMariaNov10And15() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

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

    // Get system settings
    const settings = await SystemSettings.findOne();
    const tellerBase = settings?.baseSalaries?.teller || settings?.baseSalary?.teller || 450;
    const supervisorBase = settings?.baseSalaries?.supervisor || settings?.baseSalary?.supervisor || 600;

    console.log("=".repeat(70));
    console.log("📅 MARIA SANTA - NOVEMBER 10 & 15 CHECK");
    console.log("=".repeat(70));
    console.log("Name:", maria.name);
    console.log("Role:", maria.role);
    console.log("Current Base Salary:", maria.baseSalary);
    console.log("\nExpected Base Salaries:");
    console.log("  As Teller:     ₱" + tellerBase);
    console.log("  As Supervisor: ₱" + supervisorBase);

    // Check both dates
    const datesToCheck = [
      { date: '2025-11-10', day: 'Monday' },
      { date: '2025-11-15', day: 'Saturday' }
    ];

    for (const { date, day } of datesToCheck) {
      console.log("\n" + "=".repeat(70));
      console.log(`📆 ${day.toUpperCase()} - ${date}`);
      console.log("=".repeat(70));

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Check capital activity
      const capitalReceived = await Capital.findOne({
        tellerId: maria._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }).populate('supervisorId', 'name username');

      const capitalGiven = await Capital.find({
        supervisorId: maria._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }).populate('tellerId', 'name username');

      console.log("\n💰 Capital Activity:");
      if (capitalReceived) {
        console.log(`  ✅ RECEIVED capital: ₱${capitalReceived.amount}`);
        console.log(`     From: ${capitalReceived.supervisorId?.name || 'Unknown'}`);
        console.log(`     → Should work as TELLER (₱${tellerBase})`);
      }
      if (capitalGiven.length > 0) {
        console.log(`  ✅ GAVE capital to ${capitalGiven.length} tellers:`);
        capitalGiven.forEach(cap => {
          console.log(`     - ₱${cap.amount} to ${cap.tellerId?.name || 'Unknown'}`);
        });
        console.log(`     → Should work as SUPERVISOR (₱${supervisorBase})`);
      }
      if (!capitalReceived && capitalGiven.length === 0) {
        console.log("  ℹ️  No capital activity");
      }

      // Determine expected role and salary
      let expectedRole = maria.role;
      let expectedBaseSalary = supervisorBase;
      if (capitalReceived) {
        expectedRole = 'teller';
        expectedBaseSalary = tellerBase;
      } else if (capitalGiven.length > 0) {
        expectedRole = 'supervisor';
        expectedBaseSalary = supervisorBase;
      }

      // Check shift record
      const shift = await Shift.findOne({
        userId: maria._id,
        date: date
      });

      console.log("\n🔄 Shift Record:");
      if (shift) {
        console.log(`  ✅ EXISTS`);
        console.log(`     Assigned Role: ${shift.assignedRole}`);
        console.log(`     Worked As: ${shift.roleWorkedAs}`);
        console.log(`     Base Salary Used: ₱${shift.baseSalaryUsed}`);
        
        if (shift.roleWorkedAs !== expectedRole) {
          console.log(`     ⚠️  MISMATCH: Should be ${expectedRole}`);
        }
        if (shift.baseSalaryUsed !== expectedBaseSalary) {
          console.log(`     ⚠️  MISMATCH: Should be ₱${expectedBaseSalary}`);
        }
      } else {
        console.log(`  ❌ NOT FOUND`);
        if (capitalReceived || capitalGiven.length > 0) {
          console.log(`     ⚠️  Should exist with role: ${expectedRole}, salary: ₱${expectedBaseSalary}`);
        }
      }

      // Check payroll
      const payroll = await Payroll.findOne({
        user: maria._id,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });

      console.log("\n💵 Payroll Record:");
      if (payroll) {
        console.log(`  ✅ EXISTS`);
        console.log(`     Role: ${payroll.role}`);
        console.log(`     Base Salary: ₱${payroll.baseSalary}`);
        console.log(`     Short: ₱${payroll.short}`);
        console.log(`     Over: ₱${payroll.over}`);
        console.log(`     Total Salary: ₱${payroll.totalSalary}`);
        console.log(`     Approved: ${payroll.approved}`);
        
        const issues = [];
        if (payroll.baseSalary !== expectedBaseSalary) {
          issues.push(`Base salary is ₱${payroll.baseSalary}, should be ₱${expectedBaseSalary}`);
        }
        if (payroll.role !== expectedRole) {
          issues.push(`Role is ${payroll.role}, should be ${expectedRole}`);
        }

        if (issues.length > 0) {
          console.log("\n  ⚠️  ISSUES FOUND:");
          issues.forEach(issue => console.log(`     - ${issue}`));
          
          // Fix the payroll
          console.log("\n  🔧 FIXING...");
          payroll.role = expectedRole;
          payroll.baseSalary = expectedBaseSalary;
          payroll.totalSalary = expectedBaseSalary - (payroll.short || 0) + (payroll.over || 0);
          
          // Add adjustments
          if (payroll.adjustments && payroll.adjustments.length > 0) {
            const adjustmentTotal = payroll.adjustments.reduce((sum, adj) => sum + adj.delta, 0);
            payroll.totalSalary += adjustmentTotal;
          }
          
          await payroll.save();
          console.log(`  ✅ FIXED: Base ₱${expectedBaseSalary}, Total ₱${payroll.totalSalary}`);

          // Create shift record if missing
          if (!shift) {
            await Shift.create({
              userId: maria._id,
              assignedRole: maria.role,
              roleWorkedAs: expectedRole,
              date: date,
              baseSalaryUsed: expectedBaseSalary
            });
            console.log(`  ✅ Created shift record: ${expectedRole}`);
          }
        } else {
          console.log("\n  ✅ Payroll is CORRECT");
        }
      } else {
        console.log(`  ❌ NOT FOUND`);
        if (capitalReceived || capitalGiven.length > 0) {
          console.log(`     ⚠️  Should exist with base salary: ₱${expectedBaseSalary}`);
          
          // Create payroll
          console.log("\n  🔧 CREATING...");
          const newPayroll = await Payroll.create({
            user: maria._id,
            role: expectedRole,
            baseSalary: expectedBaseSalary,
            totalSalary: expectedBaseSalary,
            short: 0,
            over: 0,
            daysPresent: 1,
            approved: false,
            createdAt: startOfDay
          });
          console.log(`  ✅ Created payroll: Base ₱${expectedBaseSalary}, Total ₱${newPayroll.totalSalary}`);

          // Create shift record
          if (!shift) {
            await Shift.create({
              userId: maria._id,
              assignedRole: maria.role,
              roleWorkedAs: expectedRole,
              date: date,
              baseSalaryUsed: expectedBaseSalary
            });
            console.log(`  ✅ Created shift record: ${expectedRole}`);
          }
        }
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("✅ CHECK COMPLETE");
    console.log("=".repeat(70));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

checkMariaNov10And15();
