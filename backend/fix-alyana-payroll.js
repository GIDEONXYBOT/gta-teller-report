// Fix Alyana's payroll - she should have salary based on capital transactions
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import Capital from "./models/Capital.js";
import SystemSettings from "./models/SystemSettings.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function fixAlyanaPayroll() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get system settings for base salaries
    const settings = await SystemSettings.findOne();
    const baseSalaryConfig = settings?.baseSalary || {
      admin: 1000,
      assistantAdmin: 600,
      supervisor: 600,
      declarator: 600,
      watcher: 500,
      teller: 450
    };

    console.log("💰 System Base Salary Configuration:");
    Object.entries(baseSalaryConfig).forEach(([role, salary]) => {
      console.log(`   ${role}: ₱${salary}`);
    });
    console.log("");

    // Find Alyana by username or name variations
    const searchTerms = ["alyana", "alyanalabora", "alyana labora"];
    let alyana = null;

    for (const term of searchTerms) {
      alyana = await User.findOne({
        $or: [
          { username: new RegExp(term, 'i') },
          { name: new RegExp(term, 'i') },
          { email: new RegExp(term, 'i') }
        ]
      });
      if (alyana) break;
    }

    if (!alyana) {
      console.log("❌ Alyana not found. Let's check all tellers:");
      const tellers = await User.find({ role: "teller" }).select('name username email');
      console.log("\n📋 All tellers in database:");
      tellers.forEach(t => {
        console.log(`   ${t.username} | ${t.name} | ${t.email || 'No email'}`);
      });
      return;
    }

    console.log(`\n👤 Found: ${alyana.name} (${alyana.username})`);
    console.log(`   Role: ${alyana.role}`);
    console.log(`   Base Salary: ₱${alyana.baseSalary || 0}`);
    console.log(`   User ID: ${alyana._id}`);

    // Check her capital transactions
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    console.log(`\n📅 Checking transactions for ${monthStart.toLocaleDateString()} to ${monthEnd.toLocaleDateString()}`);

    // Check capital transactions where she was the teller
    const capitalAsTeller = await Capital.find({
      tellerId: alyana._id,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    }).sort({ createdAt: 1 });

    // Check capital transactions where she was the supervisor
    const capitalAsSupervisor = await Capital.find({
      supervisorId: alyana._id,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    }).sort({ createdAt: 1 });

    console.log(`\n💰 Capital transactions this month:`);
    console.log(`   As Teller: ${capitalAsTeller.length} transactions`);
    console.log(`   As Supervisor: ${capitalAsSupervisor.length} transactions`);

    if (capitalAsTeller.length > 0) {
      console.log(`\n📊 Capital as Teller:`);
      capitalAsTeller.forEach(cap => {
        console.log(`   ${cap.createdAt.toLocaleDateString()} - ₱${cap.amount} (Type: ${cap.type})`);
      });
    }

    if (capitalAsSupervisor.length > 0) {
      console.log(`\n📊 Capital as Supervisor:`);
      capitalAsSupervisor.forEach(cap => {
        console.log(`   ${cap.createdAt.toLocaleDateString()} - ₱${cap.amount} (Type: ${cap.type})`);
      });
    }

    // Check her current payroll
    let payroll = await Payroll.findOne({
      user: alyana._id,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    console.log(`\n💵 Current Payroll:`);
    if (payroll) {
      console.log(`   Base Salary: ₱${payroll.baseSalary || 0}`);
      console.log(`   Total Salary: ₱${payroll.totalSalary || 0}`);
      console.log(`   Over: ₱${payroll.over || 0}`);
      console.log(`   Short: ₱${payroll.short || 0}`);
      console.log(`   Deduction: ₱${payroll.deduction || 0}`);
      console.log(`   Created: ${payroll.createdAt.toLocaleDateString()}`);
    } else {
      console.log(`   ❌ No payroll found for this month`);
    }

    // Fix her base salary and payroll
    if ((capitalAsTeller.length > 0 || capitalAsSupervisor.length > 0)) {
      console.log(`\n🔧 Fixing Alyana's payroll...`);

      // Get base salary from admin settings based on her role
      let roleBaseSalary = baseSalaryConfig[alyana.role] || baseSalaryConfig.teller;
      
      // Handle special role mappings
      if (alyana.role === 'supervisor_teller') {
        roleBaseSalary = baseSalaryConfig.supervisor;
      }

      console.log(`📋 Using admin settings base salary for ${alyana.role}: ₱${roleBaseSalary}`);

      // Set base salary if not set or if it doesn't match admin settings
      if (!alyana.baseSalary || alyana.baseSalary === 0 || alyana.baseSalary !== roleBaseSalary) {
        alyana.baseSalary = roleBaseSalary;
        await alyana.save();
        console.log(`✅ Updated user base salary to ₱${roleBaseSalary} (from admin settings)`);
      }

      // Create or update payroll
      if (!payroll) {
        payroll = new Payroll({
          user: alyana._id,
          role: alyana.role,
          baseSalary: alyana.baseSalary,
          over: 0,
          short: 0,
          deduction: 0,
          withdrawal: 0,
          totalSalary: alyana.baseSalary,
          approved: false,
          locked: false,
          withdrawn: false,
          adjustments: [],
          createdAt: capitalAsTeller.length > 0 ? capitalAsTeller[0].createdAt : capitalAsSupervisor[0].createdAt
        });
        await payroll.save();
        console.log(`✅ Created new payroll with base salary ₱${alyana.baseSalary}`);
      } else {
        // Update existing payroll
        const wasUpdated = payroll.baseSalary !== alyana.baseSalary;
        payroll.baseSalary = alyana.baseSalary;
        payroll.totalSalary = alyana.baseSalary + (payroll.over || 0) - (payroll.short || 0) - (payroll.deduction || 0) - (payroll.withdrawal || 0);
        await payroll.save();
        if (wasUpdated) {
          console.log(`✅ Updated payroll base salary to ₱${alyana.baseSalary} (from admin settings)`);
          console.log(`✅ Updated total salary to ₱${payroll.totalSalary}`);
        } else {
          console.log(`ℹ️ Payroll was already correct`);
        }
      }

      console.log(`\n✅ Alyana's payroll has been fixed using admin settings!`);
      console.log(`   Admin Setting: ${alyana.role} = ₱${roleBaseSalary}`);
      console.log(`   User Base Salary: ₱${alyana.baseSalary}`);
      console.log(`   Total Salary: ₱${payroll.totalSalary}`);
    } else {
      console.log(`\n⚠️ Alyana has no capital transactions this month`);
      console.log(`   No payroll changes made`);
    }

    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

fixAlyanaPayroll();