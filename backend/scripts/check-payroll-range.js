import mongoose from 'mongoose';
import Payroll from '../models/Payroll.js';
import User from '../models/User.js';
import computeMod from '../lib/payrollCalc.js';

const { computeTotalSalary } = computeMod;

function usage() {
  console.log('Usage: node check-payroll-range.js <startDate> <endDate>');
  console.log('Dates are ISO or YYYY-MM-DD. Example: node check-payroll-range.js 2025-11-01 2025-11-28');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    usage();
    process.exit(1);
  }

  const startDate = new Date(args[0]);
  const endDate = new Date(args[1]);
  if (isNaN(startDate) || isNaN(endDate)) {
    console.error('Invalid dates provided');
    usage();
    process.exit(1);
  }

  // Normalize to day boundaries
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb+srv://rmi_admin:rmi1234@rmi-teller-report.fphrmaw.mongodb.net/rmi?retryWrites=true&w=majority&connectTimeoutMS=30000&socketTimeoutMS=30000';

  try {
    await mongoose.connect(uri);
    console.log(`Connected to DB`);

    const payrolls = await Payroll.find({ createdAt: { $gte: start, $lte: end } }).populate('user', 'username name baseSalary role').lean();

    if (!payrolls || payrolls.length === 0) {
      console.log('No payrolls found in the provided range.');
      process.exit(0);
    }

    let mismatches = 0;
    console.log(`Checking ${payrolls.length} payroll(s) between ${start.toISOString()} and ${end.toISOString()}`);

    for (const p of payrolls) {
      const user = p.user || {};
      // Decide whether short is treated as weekly installment or full amount.
      // Heuristic: if payroll.shortPaymentTerms exists and > 1 -> treat short as full amount (divide for weekly calc)
      // However, if payroll was created by sync-teller-reports it often stores an already-divided weekly short.
      // We'll compute both and show the difference.

      const expectedWeekly = computeTotalSalary({
        baseSalary: p.baseSalary || (user.baseSalary || 0),
        over: p.over || 0,
        short: p.short || 0,
        deduction: p.deduction || 0,
        withdrawal: p.withdrawal || 0,
        shortPaymentTerms: p.shortPaymentTerms || 1,
        shortIsInstallment: false
      }, { period: 'weekly' });

      const expectedWeeklyIfInstallment = computeTotalSalary({
        baseSalary: p.baseSalary || (user.baseSalary || 0),
        over: p.over || 0,
        short: p.short || 0,
        deduction: p.deduction || 0,
        withdrawal: p.withdrawal || 0,
        shortPaymentTerms: p.shortPaymentTerms || 1,
        shortIsInstallment: true
      }, { period: 'weekly' });

      const expectedMonthly = computeTotalSalary({
        baseSalary: p.baseSalary || (user.baseSalary || 0),
        over: p.over || 0,
        short: p.short || 0,
        deduction: p.deduction || 0,
        withdrawal: p.withdrawal || 0
      }, { period: 'monthly' });

      const current = Number(p.totalSalary || 0);

      // If current is equal to one of the expected values, it's likely consistent.
      const matchWeekly = Math.abs(current - expectedWeekly) < 0.01;
      const matchWeeklyInstall = Math.abs(current - expectedWeeklyIfInstallment) < 0.01;
      const matchMonthly = Math.abs(current - expectedMonthly) < 0.01;

      const ok = matchWeekly || matchWeeklyInstall || matchMonthly;

      if (!ok) {
        mismatches++;
        console.log('--- MISMATCH ---');
        console.log(`Payroll ID: ${p._id}`);
        console.log(`User: ${user.username || user.name || p.user}`);
        console.log(`  Stored total: ₱${current}`);
        console.log(`  Expected (weekly - divide): ₱${expectedWeekly.toFixed(2)}`);
        console.log(`  Expected (weekly - installment): ₱${expectedWeeklyIfInstallment.toFixed(2)}`);
        console.log(`  Expected (monthly): ₱${expectedMonthly.toFixed(2)}`);
        console.log(`  base=${p.baseSalary || user.baseSalary || 0} over=${p.over || 0} short=${p.short || 0} terms=${p.shortPaymentTerms || 1} deduction=${p.deduction || 0} withdrawal=${p.withdrawal || 0}`);
        console.log('');
      }
    }

    console.log(`Done. Mismatches: ${mismatches}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error checking payrolls:', err?.message || err);
    process.exit(2);
  }
}

main();
