import mongoose from "mongoose";
import Payroll from "./models/Payroll.js";
import User from "./models/User.js";
import { computeTotalSalary } from "./lib/payrollCalc.js";

const MONGO_URI = "mongodb://localhost:27017/rmi-teller-report";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to Local MongoDB\n");
    
    try {
      // Find Shane and Apple
      const shane = await User.findOne({ name: "Shane" }).lean();
      const apple = await User.findOne({ name: "Apple" }).lean();
      
      const users = [shane, apple].filter(u => u);
      
      if (users.length === 0) {
        console.log("❌ Neither Shane nor Apple found");
        mongoose.connection.close();
        process.exit(1);
      }
      
      let totalFixed = 0;
      
      for (const user of users) {
        console.log(`\n📊 Fixing ${user.name}'s payroll records...`);
        console.log(`   User ID: ${user._id}`);
        console.log(`   Base Salary: ₱${user.baseSalary}\n`);
        
        // Find all payroll records for this user
        const payrolls = await Payroll.find({ user: user._id });
        
        console.log(`   Found ${payrolls.length} payroll records\n`);
        
        for (const payroll of payrolls) {
          console.log(`   Record: ${payroll.date || payroll.createdAt.toISOString().split('T')[0]}`);
          console.log(`     Old baseSalary: ₱${payroll.baseSalary || 0}`);
          console.log(`     Old totalSalary: ₱${payroll.totalSalary || 0}`);
          
          // Recalculate with correct base salary
          // Get days present from the record
          const daysPresent = payroll.daysPresent || 1;
          const newBaseSalary = daysPresent * (user.baseSalary || 0);
          
          // Recalculate total salary
          const newTotalSalary = computeTotalSalary({
            baseSalary: newBaseSalary,
            over: payroll.over || 0,
            short: payroll.short || 0,
            deduction: payroll.deduction || 0,
            withdrawal: payroll.withdrawal || 0,
            shortIsInstallment: true
          }, { period: payroll.period || "monthly" });
          
          // Update the record
          payroll.baseSalary = newBaseSalary;
          payroll.totalSalary = newTotalSalary;
          await payroll.save();
          
          console.log(`     New baseSalary: ₱${newBaseSalary}`);
          console.log(`     New totalSalary: ₱${newTotalSalary}\n`);
          
          totalFixed++;
        }
      }
      
      console.log(`\n✅ Fixed ${totalFixed} payroll records total!\n`);
      
      // Verify the fixes
      console.log("📋 Verification - Recent payroll records:");
      for (const user of users) {
        console.log(`\n${user.name}:`);
        const recent = await Payroll.find({ user: user._id })
          .sort({ date: -1 })
          .limit(3)
          .lean();
        
        recent.forEach((p, idx) => {
          console.log(`  ${idx + 1}. Date: ${p.date || p.createdAt.toISOString().split('T')[0]}`);
          console.log(`     Base: ₱${p.baseSalary}, Over: ₱${p.over}, Short: ₱${p.short}, Total: ₱${p.totalSalary}`);
        });
      }
      
      mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed:", err.message);
      mongoose.connection.close();
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
