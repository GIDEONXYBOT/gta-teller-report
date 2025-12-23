import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import User from './models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

/**
 * Comprehensive Payroll Health Check
 * Verifies:
 * 1. No duplicate payroll entries
 * 2. No orphaned payrolls (no corresponding reports)
 * 3. Base salary consistency
 * 4. Calculation accuracy (over/short/deductions)
 * 5. Payment terms applied correctly
 */
async function performHealthCheck() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const report = {
      timestamp: new Date().toISOString(),
      stats: {
        totalPayrolls: 0,
        totalUsers: 0,
        totalReports: 0,
      },
      checks: {
        duplicates: { passed: true, count: 0, issues: [] },
        orphaned: { passed: true, count: 0, issues: [] },
        baseSalaryConsistency: { passed: true, count: 0, issues: [] },
        calculationAccuracy: { passed: true, count: 0, issues: [] },
        paymentTerms: { passed: true, count: 0, issues: [] },
      },
      summary: {},
    };

    // 1. Get base stats
    const payrolls = await Payroll.find().populate('user', 'username name role baseSalary');
    const users = await User.find().distinct('_id');
    const reports = await TellerReport.find();

    report.stats.totalPayrolls = payrolls.length;
    report.stats.totalUsers = users.length;
    report.stats.totalReports = reports.length;

    console.log('📊 Database Statistics:');
    console.log(`   Total Payroll Entries: ${report.stats.totalPayrolls}`);
    console.log(`   Total Users: ${report.stats.totalUsers}`);
    console.log(`   Total Teller Reports: ${report.stats.totalReports}\n`);

    // 2. Check for duplicates (same user, same month)
    console.log('🔍 Checking for duplicates...');
    const userMonthMap = {};
    for (const p of payrolls) {
      const key = `${p.user._id}-${new Date(p.createdAt).toISOString().substring(0, 7)}`;
      if (!userMonthMap[key]) {
        userMonthMap[key] = [];
      }
      userMonthMap[key].push(p);
    }

    for (const [key, entries] of Object.entries(userMonthMap)) {
      if (entries.length > 1) {
        report.checks.duplicates.passed = false;
        report.checks.duplicates.count++;
        report.checks.duplicates.issues.push({
          key,
          count: entries.length,
          payrollIds: entries.map(e => e._id),
        });
      }
    }
    console.log(`   ${report.checks.duplicates.passed ? '✅' : '❌'} Duplicates: ${report.checks.duplicates.count === 0 ? 'None found' : `${report.checks.duplicates.count} issues`}\n`);

    // 3. Check for orphaned payrolls
    console.log('🔍 Checking for orphaned payrolls...');
    for (const payroll of payrolls) {
      const payrollDate = payroll.date || new Date(payroll.createdAt).toISOString().split('T')[0];
      const relatedReports = await TellerReport.find({
        user: payroll.user._id,
        date: payrollDate,
      });

      if (relatedReports.length === 0) {
        report.checks.orphaned.passed = false;
        report.checks.orphaned.count++;
        report.checks.orphaned.issues.push({
          payrollId: payroll._id,
          user: payroll.user.name || payroll.user.username,
          date: payrollDate,
          over: payroll.over,
          short: payroll.short,
        });
      }
    }
    console.log(`   ${report.checks.orphaned.passed ? '✅' : '❌'} Orphaned Payrolls: ${report.checks.orphaned.count === 0 ? 'None found' : `${report.checks.orphaned.count} issues`}\n`);

    // 4. Check base salary consistency
    console.log('🔍 Checking base salary consistency...');
    for (const payroll of payrolls) {
      const user = payroll.user;
      const expectedBase = (user.baseSalary || 0) * (payroll.daysPresent || 1);
      
      if (Math.abs(payroll.baseSalary - expectedBase) > 0.01) {
        report.checks.baseSalaryConsistency.passed = false;
        report.checks.baseSalaryConsistency.count++;
        report.checks.baseSalaryConsistency.issues.push({
          payrollId: payroll._id,
          user: user.name || user.username,
          expected: expectedBase,
          actual: payroll.baseSalary,
          daysPresent: payroll.daysPresent,
          dailyRate: user.baseSalary,
        });
      }
    }
    console.log(`   ${report.checks.baseSalaryConsistency.passed ? '✅' : '❌'} Base Salary: ${report.checks.baseSalaryConsistency.count === 0 ? 'All correct' : `${report.checks.baseSalaryConsistency.count} issues`}\n`);

    // 5. Check calculation accuracy
    console.log('🔍 Checking calculation accuracy...');
    for (const payroll of payrolls) {
      const expectedTotal = payroll.baseSalary + payroll.over - payroll.short - (payroll.deduction || 0) - (payroll.withdrawal || 0);
      
      if (Math.abs(payroll.totalSalary - expectedTotal) > 0.01) {
        report.checks.calculationAccuracy.passed = false;
        report.checks.calculationAccuracy.count++;
        report.checks.calculationAccuracy.issues.push({
          payrollId: payroll._id,
          user: payroll.user.name || payroll.user.username,
          expected: expectedTotal,
          actual: payroll.totalSalary,
          calculation: `${payroll.baseSalary} + ${payroll.over} - ${payroll.short} - ${payroll.deduction} - ${payroll.withdrawal}`,
        });
      }
    }
    console.log(`   ${report.checks.calculationAccuracy.passed ? '✅' : '❌'} Calculations: ${report.checks.calculationAccuracy.count === 0 ? 'All correct' : `${report.checks.calculationAccuracy.count} issues`}\n`);

    // 6. Check payment terms
    console.log('🔍 Checking payment terms...');
    for (const payroll of payrolls) {
      if (payroll.shortPaymentTerms && payroll.shortPaymentTerms > 1) {
        // If payment terms > 1, short should be spread
        const weeklyShort = payroll.short / (payroll.shortPaymentTerms || 1);
        if (weeklyShort < 0 || isNaN(weeklyShort)) {
          report.checks.paymentTerms.passed = false;
          report.checks.paymentTerms.count++;
          report.checks.paymentTerms.issues.push({
            payrollId: payroll._id,
            user: payroll.user.name || payroll.user.username,
            issue: `Invalid payment terms calculation: ${payroll.short} / ${payroll.shortPaymentTerms}`,
          });
        }
      }
    }
    console.log(`   ${report.checks.paymentTerms.passed ? '✅' : '❌'} Payment Terms: ${report.checks.paymentTerms.count === 0 ? 'All correct' : `${report.checks.paymentTerms.count} issues`}\n`);

    // Summary
    const allPassed = Object.values(report.checks).every(check => check.passed);
    console.log('=' * 60);
    console.log(`🎯 OVERALL STATUS: ${allPassed ? '✅ HEALTHY' : '⚠️  ISSUES FOUND'}`);
    console.log('=' * 60);
    console.log('\n📋 Detailed Summary:');
    console.log(`   Duplicates: ${report.checks.duplicates.passed ? '✅' : '❌'}`);
    console.log(`   Orphaned: ${report.checks.orphaned.passed ? '✅' : '❌'}`);
    console.log(`   Base Salary: ${report.checks.baseSalaryConsistency.passed ? '✅' : '❌'}`);
    console.log(`   Calculations: ${report.checks.calculationAccuracy.passed ? '✅' : '❌'}`);
    console.log(`   Payment Terms: ${report.checks.paymentTerms.passed ? '✅' : '❌'}\n`);

    if (!allPassed) {
      console.log('⚠️  ISSUES DETECTED:');
      if (report.checks.duplicates.count > 0) {
        console.log(`   Run: node cleanup-duplicate-payrolls.js`);
      }
      if (report.checks.orphaned.count > 0) {
        console.log(`   Run: node cleanup-orphaned-payrolls.js`);
      }
      if (report.checks.baseSalaryConsistency.count > 0) {
        console.log(`   Run: node fixIncorrectBaseSalaries.js`);
      }
      if (report.checks.calculationAccuracy.count > 0) {
        console.log(`   Run: node fix-payroll-calculations.js`);
      }
      console.log('');
    }

    await mongoose.disconnect();
    return report;
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

performHealthCheck().then(() => {
  console.log('✅ Health check complete');
  process.exit(0);
});
