/**
 * PAYROLL OVER RECONCILIATION TOOL
 * 
 * Purpose: Verify and fix payroll over/short amounts based on actual teller reports
 * 
 * Usage:
 *   node reconcile-payroll-with-reports.js [mode] [options]
 * 
 * Modes:
 *   check     - Check for discrepancies without fixing (default)
 *   fix       - Fix discrepancies
 *   report    - Generate detailed report
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import User from './models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';
const MODE = process.argv[2] || 'check';
const USER_FILTER = process.argv[3] || null; // Optional: filter by user ID

async function reconcilePayroll() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all payrolls with teller reports
    let payrollQuery = Payroll.find();
    if (USER_FILTER) {
      payrollQuery = payrollQuery.where('user').equals(USER_FILTER);
    }
    const payrolls = await payrollQuery
      .populate('user', 'username name role baseSalary')
      .sort({ createdAt: -1 });

    console.log(`📊 Analyzing ${payrolls.length} payroll entries (Mode: ${MODE})\n`);

    if (payrolls.length === 0) {
      console.log('ℹ️  No payrolls found');
      await mongoose.disconnect();
      return;
    }

    let discrepancies = [];
    let processed = 0;
    let fixed = 0;
    let alreadyCorrect = 0;

    for (const payroll of payrolls) {
      processed++;
      const payrollDate = payroll.date || new Date(payroll.createdAt).toISOString().split('T')[0];
      
      // Find teller reports
      const tellerReports = await TellerReport.find({
        user: payroll.user._id,
        date: payrollDate
      }).lean();

      if (tellerReports.length === 0) {
        continue; // No reports for this date
      }

      // Calculate expected values from reports
      const expectedOver = tellerReports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
      const expectedShort = tellerReports.reduce((sum, r) => sum + (Number(r.short) || 0), 0);

      const currentOver = payroll.over || 0;
      const currentShort = payroll.short || 0;

      // Check for discrepancies
      const overMismatch = currentOver !== expectedOver;
      const shortMismatch = currentShort !== expectedShort;

      if (overMismatch || shortMismatch) {
        const discrepancy = {
          payrollId: payroll._id,
          user: payroll.user.name || payroll.user.username,
          date: payrollDate,
          reportCount: tellerReports.length,
          over: { current: currentOver, expected: expectedOver, match: !overMismatch },
          short: { current: currentShort, expected: expectedShort, match: !shortMismatch },
          oldTotal: payroll.totalSalary || 0,
        };

        // Calculate new total if we were to fix
        if (MODE === 'fix' || MODE === 'report') {
          const newTotal = (payroll.baseSalary || 0) + expectedOver - expectedShort - (payroll.deduction || 0) - (payroll.withdrawal || 0);
          discrepancy.newTotal = newTotal;
          discrepancy.adjustment = newTotal - discrepancy.oldTotal;
        }

        discrepancies.push(discrepancy);

        // Apply fix if in fix mode
        if (MODE === 'fix') {
          payroll.over = expectedOver;
          payroll.short = expectedShort;
          payroll.totalSalary = discrepancy.newTotal;
          
          if (!payroll.adjustments) payroll.adjustments = [];
          payroll.adjustments.push({
            delta: discrepancy.adjustment,
            reason: `Auto-reconcile from ${tellerReports.length} teller report(s): Over=₱${expectedOver}, Short=₱${expectedShort}`,
            createdAt: new Date(),
          });

          await payroll.save();
          fixed++;
        }
      } else {
        alreadyCorrect++;
      }
    }

    // Display results
    console.log('═'.repeat(80));
    if (MODE === 'check') {
      console.log('🔍 CHECK MODE - Discrepancies Found');
    } else if (MODE === 'fix') {
      console.log('🔧 FIX MODE - Applied Corrections');
    } else {
      console.log('📋 REPORT MODE - Detailed Analysis');
    }
    console.log('═'.repeat(80));

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total processed: ${processed}`);
    console.log(`   Discrepancies found: ${discrepancies.length}`);
    if (MODE === 'fix') console.log(`   Payrolls fixed: ${fixed}`);
    console.log(`   Already correct: ${alreadyCorrect}`);

    if (discrepancies.length > 0) {
      console.log(`\n📋 DISCREPANCIES:\n`);
      discrepancies.forEach((d, idx) => {
        console.log(`${idx + 1}. ${d.user} - ${d.date}`);
        console.log(`   Reports: ${d.reportCount}`);
        
        if (!d.over.match) {
          console.log(`   ❌ Over: ₱${d.over.current} (expected ₱${d.over.expected})`);
        } else {
          console.log(`   ✅ Over: ₱${d.over.current}`);
        }

        if (!d.short.match) {
          console.log(`   ❌ Short: ₱${d.short.current} (expected ₱${d.short.expected})`);
        } else {
          console.log(`   ✅ Short: ₱${d.short.current}`);
        }

        if (MODE === 'fix' || MODE === 'report') {
          const adjustment = d.adjustment || 0;
          console.log(`   Total: ₱${d.oldTotal} → ₱${d.newTotal} (${adjustment > 0 ? '+' : ''}₱${adjustment.toFixed(2)})`);
        }
        console.log('');
      });
    } else {
      console.log('✅ All payrolls match their teller reports!\n');
    }

    // Show instructions
    console.log('═'.repeat(80));
    console.log('💡 USAGE INSTRUCTIONS:');
    console.log('═'.repeat(80));
    console.log(`   Check discrepancies: node reconcile-payroll-with-reports.js check`);
    console.log(`   Fix discrepancies:   node reconcile-payroll-with-reports.js fix`);
    console.log(`   Generate report:     node reconcile-payroll-with-reports.js report`);
    console.log(`   For specific user:   node reconcile-payroll-with-reports.js [mode] [userID]`);
    console.log('');

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

reconcilePayroll();
