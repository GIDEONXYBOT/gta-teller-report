import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import User from './models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function diagnoseCalculationIssue() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check all teller reports first
    const allReports = await TellerReport.find().lean();
    console.log(`📊 Teller Reports in system: ${allReports.length}`);
    
    if (allReports.length > 0) {
      console.log('\n🔍 Sample Teller Reports (first 5):');
      allReports.slice(0, 5).forEach((r, idx) => {
        console.log(`\n${idx + 1}. User: ${r.user}`);
        console.log(`   Date: ${r.date} (type: ${typeof r.date})`);
        console.log(`   Over: ₱${r.over}`);
        console.log(`   Short: ₱${r.short}`);
        console.log(`   CreatedAt: ${r.createdAt}`);
      });
    }

    // Check all payrolls
    const allPayrolls = await Payroll.find().populate('user', 'username name').lean();
    console.log(`\n\n💰 Payrolls in system: ${allPayrolls.length}`);
    
    if (allPayrolls.length > 0) {
      console.log('\n🔍 Sample Payrolls (first 5):');
      allPayrolls.slice(0, 5).forEach((p, idx) => {
        console.log(`\n${idx + 1}. User: ${p.user?.name || p.user?.username}`);
        console.log(`   Date field: ${p.date} (type: ${typeof p.date})`);
        console.log(`   CreatedAt: ${new Date(p.createdAt).toISOString()}`);
        console.log(`   Over: ₱${p.over}`);
        console.log(`   Short: ₱${p.short}`);
        console.log(`   Base Salary: ₱${p.baseSalary}`);
        console.log(`   Total Salary: ₱${p.totalSalary}`);
        console.log(`   Days Present: ${p.daysPresent}`);
      });
    }

    // Test date matching logic
    if (allPayrolls.length > 0 && allReports.length > 0) {
      console.log(`\n\n🔧 DATE MATCHING TEST:`);
      console.log('─'.repeat(70));

      // Take first payroll
      const testPayroll = allPayrolls[0];
      const payrollDate = testPayroll.date || new Date(testPayroll.createdAt).toISOString().split('T')[0];
      
      console.log(`\nPayroll Date (${testPayroll.user?.name || 'unknown'}):`);
      console.log(`  Value: "${payrollDate}"`);
      console.log(`  Type: ${typeof payrollDate}`);

      // Try to find matching reports
      console.log(`\nSearching for reports with date: "${payrollDate}"`);
      
      const matchingReports = await TellerReport.find({
        user: testPayroll.user._id,
        date: payrollDate
      }).lean();

      console.log(`  Found: ${matchingReports.length} report(s)`);
      
      if (matchingReports.length > 0) {
        const overSum = matchingReports.reduce((sum, r) => sum + (r.over || 0), 0);
        const shortSum = matchingReports.reduce((sum, r) => sum + (r.short || 0), 0);
        
        console.log(`\n  Total Over from reports: ₱${overSum}`);
        console.log(`  Total Short from reports: ₱${shortSum}`);
        console.log(`  Payroll Over: ₱${testPayroll.over}`);
        console.log(`  Payroll Short: ₱${testPayroll.short}`);
        
        if (overSum !== testPayroll.over || shortSum !== testPayroll.short) {
          console.log(`\n  ⚠️  MISMATCH DETECTED!`);
          console.log(`  Over: ${testPayroll.over} vs expected ${overSum}`);
          console.log(`  Short: ${testPayroll.short} vs expected ${shortSum}`);
        } else {
          console.log(`\n  ✅ Values match correctly`);
        }
      } else {
        console.log(`\n  ❌ NO MATCHING REPORTS FOUND`);
        console.log(`  This could be a date format mismatch issue!`);
        
        // Try to diagnose why
        console.log(`\n  Diagnostic: Looking at all reports for this user...`);
        const userReports = await TellerReport.find({ user: testPayroll.user._id }).lean();
        console.log(`  Total reports for this user: ${userReports.length}`);
        if (userReports.length > 0) {
          console.log(`  Dates in system:`);
          userReports.slice(0, 10).forEach(r => {
            console.log(`    - "${r.date}" (type: ${typeof r.date})`);
          });
        }
      }
    }

    // Check calculation formula
    console.log(`\n\n📐 CALCULATION VERIFICATION:`);
    console.log('─'.repeat(70));
    
    if (allPayrolls.length > 0) {
      const p = allPayrolls[0];
      const baseSalary = p.baseSalary || 0;
      const over = p.over || 0;
      const short = p.short || 0;
      const deduction = p.deduction || 0;
      const withdrawal = p.withdrawal || 0;
      
      const calculatedTotal = baseSalary + over - short - deduction - withdrawal;
      const storedTotal = p.totalSalary || 0;
      
      console.log(`\nPayroll: ${p.user?.name || 'unknown'}`);
      console.log(`  Base: ₱${baseSalary}`);
      console.log(`  Over: ₱${over}`);
      console.log(`  Short: ₱${short}`);
      console.log(`  Deduction: ₱${deduction}`);
      console.log(`  Withdrawal: ₱${withdrawal}`);
      console.log(`\n  Calculated: ₱${baseSalary} + ₱${over} - ₱${short} - ₱${deduction} - ₱${withdrawal}`);
      console.log(`  = ₱${calculatedTotal}`);
      console.log(`\n  Stored Total: ₱${storedTotal}`);
      
      if (Math.abs(calculatedTotal - storedTotal) > 0.01) {
        console.log(`  ❌ MISMATCH! Expected ₱${calculatedTotal} but got ₱${storedTotal}`);
      } else {
        console.log(`  ✅ Calculation correct`);
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

diagnoseCalculationIssue();
