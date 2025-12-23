import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TellerReport from './models/TellerReport.js';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function syncReportsToPayrolls() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const startDate = new Date('2025-11-27T00:00:00Z');
    // exclusive end (next day after last day)
    const endDate = new Date('2025-11-30T00:00:00Z');

    console.log(`📅 Syncing TellerReport documents from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const reports = await TellerReport.find({
      createdAt: { $gte: startDate, $lt: endDate }
    }).populate('tellerId', 'username name baseSalary role').sort({ createdAt: 1 }).lean();

    console.log(`📊 Found ${reports.length} reports in DB`);

    // Group by user + date key (YYYY-MM-DD) and pick the *most recent* report for that day
    const byUserDate = {};
    for (const r of reports) {
      if (!r.tellerId) continue; // skip reports without a mapped user
      const d = new Date(r.createdAt);
      const dateKey = d.toISOString().split('T')[0];
      const key = `${r.tellerId._id}_${dateKey}`;

      // prefer latest: replace if this report is newer
      if (!byUserDate[key] || new Date(r.createdAt) >= new Date(byUserDate[key].createdAt)) {
        byUserDate[key] = r;
      }
    }

    const entries = Object.values(byUserDate);
    console.log(`🔁 Unique user/day entries to process: ${entries.length}`);

    let updated = 0;
    let createdCount = 0;

    for (const report of entries) {
      const user = report.tellerId;
      const reportDate = new Date(report.createdAt);
      const dateKey = reportDate.toISOString().split('T')[0];

      // find existing payroll record for user & date
      const existing = await Payroll.findOne({ user: user._id, date: dateKey });

      const baseSalary = Number(user.baseSalary || 0);
      const over = Number(report.over || 0);
      const short = Number(report.short || 0);
      const deduction = 0;
      const withdrawal = 0;
      const totalSalary = baseSalary + over - short - deduction - withdrawal;

      if (existing) {
        existing.baseSalary = baseSalary;
        existing.over = over;
        existing.short = short;
        existing.deduction = deduction;
        existing.withdrawal = withdrawal;
        existing.totalSalary = totalSalary;
        existing.createdAt = report.createdAt;
        // set date string too
        existing.date = dateKey;
        await existing.save();
        updated++;
        console.log(`📌 Updated payroll for ${user.username} (${dateKey}) → total: ${totalSalary}`);
      } else {
        await Payroll.create({
          user: user._id,
          role: user.role || 'teller',
          baseSalary,
          over,
          short,
          deduction,
          withdrawal,
          totalSalary,
          approved: false,
          date: dateKey,
          createdAt: report.createdAt
        });
        createdCount++;
        console.log(`➕ Created payroll for ${user.username} (${dateKey}) → total: ${totalSalary}`);
      }
    }

    console.log('\n✅ Sync complete');
    console.log(`   Updated: ${updated}`);
    console.log(`   Created: ${createdCount}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error while syncing:', err);
    process.exit(1);
  }
}

syncReportsToPayrolls();
