import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import Capital from "./models/Capital.js";
import TellerReport from "./models/TellerReport.js";
import Shift from "./models/Shift.js";
import SystemSettings from "./models/SystemSettings.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller";

async function checkMariaSanta() {
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
    console.log("👤 USER INFORMATION");
    console.log("=".repeat(60));
    console.log("Name:", maria.name || maria.username);
    console.log("Username:", maria.username);
    console.log("Role:", maria.role);
    console.log("Base Salary:", maria.baseSalary);
    console.log("Supervisor ID:", maria.supervisorId || "None");
    console.log("Active:", maria.active);
    console.log("Status:", maria.status);

    // Get system settings
    const settings = await SystemSettings.findOne();
    const baseSalaries = {
      teller: settings?.baseSalaries?.teller || 450,
      supervisor: settings?.baseSalaries?.supervisor || 500,
      supervisor_teller: settings?.baseSalaries?.supervisor_teller || 500,
    };

    console.log("\n" + "=".repeat(60));
    console.log("💰 CAPITAL RECORDS");
    console.log("=".repeat(60));

    // Check capital as teller (receiving)
    const capitalAsTeller = await Capital.find({ tellerId: maria._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("supervisorId", "name username");

    if (capitalAsTeller.length > 0) {
      console.log("\n📥 Capital RECEIVED (as Teller):");
      capitalAsTeller.forEach((cap, idx) => {
        console.log(`  ${idx + 1}. Date: ${new Date(cap.createdAt).toLocaleDateString()}`);
        console.log(`     Amount: ₱${cap.amount}`);
        console.log(`     Status: ${cap.status}`);
        console.log(`     From: ${cap.supervisorId?.name || cap.supervisorId?.username || 'Unknown'}`);
      });
    } else {
      console.log("\n📥 No capital received as teller");
    }

    // Check capital as supervisor (giving)
    const capitalAsSupervisor = await Capital.find({ supervisorId: maria._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("tellerId", "name username");

    if (capitalAsSupervisor.length > 0) {
      console.log("\n📤 Capital GIVEN (as Supervisor):");
      capitalAsSupervisor.forEach((cap, idx) => {
        console.log(`  ${idx + 1}. Date: ${new Date(cap.createdAt).toLocaleDateString()}`);
        console.log(`     Amount: ₱${cap.amount}`);
        console.log(`     Status: ${cap.status}`);
        console.log(`     To: ${cap.tellerId?.name || cap.tellerId?.username || 'Unknown'}`);
      });
    } else {
      console.log("\n📤 No capital given as supervisor");
    }

    // Check teller reports
    console.log("\n" + "=".repeat(60));
    console.log("📋 TELLER REPORTS");
    console.log("=".repeat(60));

    const reports = await TellerReport.find({ tellerId: maria._id })
      .sort({ createdAt: -1 })
      .limit(5);

    if (reports.length > 0) {
      reports.forEach((report, idx) => {
        console.log(`  ${idx + 1}. Date: ${new Date(report.createdAt).toLocaleDateString()}`);
        console.log(`     System Balance: ₱${report.systemBalance}`);
        console.log(`     Cash on Hand: ₱${report.cashOnHand}`);
        console.log(`     Short: ₱${report.short}`);
        console.log(`     Over: ₱${report.over}`);
      });
    } else {
      console.log("No teller reports found");
    }

    // Check payroll records
    console.log("\n" + "=".repeat(60));
    console.log("💵 PAYROLL RECORDS");
    console.log("=".repeat(60));

    const payrolls = await Payroll.find({ user: maria._id })
      .sort({ createdAt: -1 })
      .limit(10);

    if (payrolls.length > 0) {
      payrolls.forEach((pay, idx) => {
        console.log(`  ${idx + 1}. Date: ${new Date(pay.createdAt).toLocaleDateString()}`);
        console.log(`     Role: ${pay.role}`);
        console.log(`     Base Salary: ₱${pay.baseSalary}`);
        console.log(`     Total Salary: ₱${pay.totalSalary}`);
        console.log(`     Short: ₱${pay.short}, Over: ₱${pay.over}`);
        console.log(`     Approved: ${pay.approved}`);
      });
    } else {
      console.log("No payroll records found");
    }

    // Check shift records
    console.log("\n" + "=".repeat(60));
    console.log("🔄 SHIFT RECORDS");
    console.log("=".repeat(60));

    const shifts = await Shift.find({ userId: maria._id })
      .sort({ date: -1 })
      .limit(10);

    if (shifts.length > 0) {
      shifts.forEach((shift, idx) => {
        console.log(`  ${idx + 1}. Date: ${shift.date}`);
        console.log(`     Assigned Role: ${shift.assignedRole}`);
        console.log(`     Worked As: ${shift.roleWorkedAs}`);
        console.log(`     Base Salary Used: ₱${shift.baseSalaryUsed}`);
      });
    } else {
      console.log("No shift records found");
    }

    // Determine correct base salary
    console.log("\n" + "=".repeat(60));
    console.log("💡 RECOMMENDATIONS");
    console.log("=".repeat(60));

    const today = new Date().toISOString().split('T')[0];
    const todayCapitalReceived = await Capital.findOne({ 
      tellerId: maria._id,
      createdAt: { $gte: new Date(today), $lte: new Date(today + 'T23:59:59') }
    });
    
    const todayCapitalGiven = await Capital.findOne({ 
      supervisorId: maria._id,
      createdAt: { $gte: new Date(today), $lte: new Date(today + 'T23:59:59') }
    });

    let recommendedRole = maria.role;
    let recommendedBaseSalary = maria.baseSalary;

    if (maria.role === 'supervisor_teller') {
      if (todayCapitalReceived) {
        recommendedRole = 'teller';
        recommendedBaseSalary = baseSalaries.teller;
        console.log(`✅ Maria received capital today → Should work as TELLER (₱${baseSalaries.teller})`);
      } else if (todayCapitalGiven) {
        recommendedRole = 'supervisor';
        recommendedBaseSalary = baseSalaries.supervisor;
        console.log(`✅ Maria gave capital today → Should work as SUPERVISOR (₱${baseSalaries.supervisor})`);
      } else {
        console.log(`ℹ️  No capital activity today → Default to assigned role (${maria.role})`);
      }
    }

    // Check if current settings are correct
    if (maria.baseSalary !== recommendedBaseSalary) {
      console.log(`\n⚠️  ISSUE: Base salary is ₱${maria.baseSalary}, should be ₱${recommendedBaseSalary}`);
      
      // Fix base salary
      await User.findByIdAndUpdate(maria._id, { baseSalary: recommendedBaseSalary });
      console.log(`✅ FIXED: Updated base salary to ₱${recommendedBaseSalary}`);
    }

    // Create/update shift record
    const todayShift = await Shift.findOne({ userId: maria._id, date: today });
    if (!todayShift && (todayCapitalReceived || todayCapitalGiven)) {
      const newShift = await Shift.create({
        userId: maria._id,
        assignedRole: maria.role,
        roleWorkedAs: recommendedRole,
        date: today,
        baseSalaryUsed: recommendedBaseSalary
      });
      console.log(`✅ Created shift record for today: Working as ${recommendedRole}`);
    } else if (todayShift) {
      console.log(`✅ Shift record exists for today: Working as ${todayShift.roleWorkedAs}`);
    }

    // Update today's payroll if needed
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const todayPayroll = await Payroll.findOne({
      user: maria._id,
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });

    if (todayPayroll && todayPayroll.baseSalary !== recommendedBaseSalary) {
      todayPayroll.baseSalary = recommendedBaseSalary;
      todayPayroll.totalSalary = recommendedBaseSalary - (todayPayroll.short || 0) + (todayPayroll.over || 0);
      
      // Add adjustments
      if (todayPayroll.adjustments && todayPayroll.adjustments.length > 0) {
        const adjustmentTotal = todayPayroll.adjustments.reduce((sum, adj) => sum + adj.delta, 0);
        todayPayroll.totalSalary += adjustmentTotal;
      }
      
      await todayPayroll.save();
      console.log(`✅ Updated today's payroll: Base salary ₱${recommendedBaseSalary}, Total ₱${todayPayroll.totalSalary}`);
    } else if (todayPayroll) {
      console.log(`✅ Today's payroll is already correct: ₱${todayPayroll.baseSalary}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ MARIA SANTA CHECK COMPLETE");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

checkMariaSanta();
