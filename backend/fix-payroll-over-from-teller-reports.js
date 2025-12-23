import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import User from './models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function fixPayrollOverFromTellerReports() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all payrolls
    const payrolls = await Payroll.find()
      .populate('user', 'username name role baseSalary')
      .sort({ createdAt: -1 });

    console.log(`📊 Found ${payrolls.length} payroll entries\n`);

    if (payrolls.length === 0) {
      console.log('❌ No payrolls found to reconcile');
      await mongoose.disconnect();
      return;
    }

    let fixed = 0;
    let alreadyCorrect = 0;
    let correctionDetails = [];

    for (const payroll of payrolls) {
      // Get the date from payroll
      const payrollDate = payroll.date || new Date(payroll.createdAt).toISOString().split('T')[0];
      
      // Find all teller reports for this user on this date
      const tellerReports = await TellerReport.find({
        user: payroll.user._id,
        date: payrollDate
      }).lean();

      if (tellerReports.length === 0) {
        // No teller reports for this date - skip
        continue;
      }

      // Calculate the correct over amount from teller reports
      const correctOver = tellerReports.reduce((sum, report) => {
        return sum + (Number(report.over) || 0);
      }, 0);

      // Calculate the correct short amount from teller reports
      const correctShort = tellerReports.reduce((sum, report) => {
        return sum + (Number(report.short) || 0);
      }, 0);

      const currentOver = payroll.over || 0;
      const currentShort = payroll.short || 0;

      // Check if correction is needed
      if (currentOver !== correctOver || currentShort !== correctShort) {
        console.log(`🔧 FIXING: ${payroll.user.name || payroll.user.username}`);
        console.log(`   Date: ${payrollDate}`);
        console.log(`   Teller Reports: ${tellerReports.length} report(s)`);
        
        if (currentOver !== correctOver) {
          console.log(`   Over: ₱${currentOver} → ₱${correctOver}`);
          correctionDetails.push({
            user: payroll.user.name || payroll.user.username,
            date: payrollDate,
            field: 'over',
            oldValue: currentOver,
            newValue: correctOver,
            payrollId: payroll._id
          });
        }

        if (currentShort !== correctShort) {
          console.log(`   Short: ₱${currentShort} → ₱${correctShort}`);
          correctionDetails.push({
            user: payroll.user.name || payroll.user.username,
            date: payrollDate,
            field: 'short',
            oldValue: currentShort,
            newValue: correctShort,
            payrollId: payroll._id
          });
        }

        // Update payroll
        const oldTotal = payroll.totalSalary || 0;
        payroll.over = correctOver;
        payroll.short = correctShort;

        // Recalculate totalSalary
        const baseSalary = payroll.baseSalary || 0;
        const deduction = payroll.deduction || 0;
        const withdrawal = payroll.withdrawal || 0;
        const newTotal = baseSalary + correctOver - correctShort - deduction - withdrawal;
        
        payroll.totalSalary = newTotal;

        console.log(`   Total: ₱${oldTotal} → ₱${newTotal}`);
        console.log(`   Adjustment: ${newTotal - oldTotal > 0 ? '+' : ''}₱${(newTotal - oldTotal).toFixed(2)}`);

        // Add adjustment note
        if (!payroll.adjustments) payroll.adjustments = [];
        payroll.adjustments.push({
          delta: newTotal - oldTotal,
          reason: `Over/short reconciled from ${tellerReports.length} teller report(s) on ${payrollDate}. Over: ₱${correctOver}, Short: ₱${correctShort}`,
          createdAt: new Date(),
        });

        await payroll.save();
        fixed++;
        console.log('   ✅ UPDATED\n');
      } else {
        alreadyCorrect++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📈 RECONCILIATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Payrolls fixed: ${fixed}`);
    console.log(`✅ Payrolls already correct: ${alreadyCorrect}`);
    console.log(`⏭️  Payrolls without teller reports: ${payrolls.length - fixed - alreadyCorrect}`);
    console.log(`\nTotal processed: ${payrolls.length}`);

    if (correctionDetails.length > 0) {
      console.log('\n' + '='.repeat(70));
      console.log('📋 DETAILED CORRECTIONS');
      console.log('='.repeat(70));
      correctionDetails.forEach((detail, idx) => {
        console.log(`${idx + 1}. ${detail.user} (${detail.date})`);
        console.log(`   ${detail.field}: ₱${detail.oldValue} → ₱${detail.newValue}`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Payroll reconciliation complete');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

fixPayrollOverFromTellerReports();
