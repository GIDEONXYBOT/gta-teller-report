// addBaseForCapitalWorkers.js
// Usage: node addBaseForCapitalWorkers.js YYYY-MM-DD [defaultBase]
// Example: node addBaseForCapitalWorkers.js 2025-11-13 450

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TellerReport from './models/TellerReport.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';
import Payroll from './models/Payroll.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';
const dateArg = process.argv[2] || new Date().toISOString().split('T')[0];
const defaultBase = Number(process.argv[3] || 450);
const dateStr = dateArg;

function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0,0,0,0);
  return dt;
}
function endOfDay(d) {
  const dt = new Date(d);
  dt.setHours(23,59,59,999);
  return dt;
}

async function run() {
  console.log(`Connecting to ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected.');

  const start = startOfDay(dateStr);
  const end = endOfDay(dateStr);

  const reports = await TellerReport.find({
    $or: [
      { date: dateStr },
      { createdAt: { $gte: start, $lt: end } }
    ]
  }).lean();

  console.log(`Found ${reports.length} report(s) that match ${dateStr}`);

  const usersSet = new Map();
  for (const r of reports) {
    const uid = (r.tellerId && String(r.tellerId)) || (r.userId && String(r.userId));
    if (!uid) continue;
    if (!usersSet.has(uid)) usersSet.set(uid, r);
  }

  console.log(`Unique users with reports: ${usersSet.size}`);

  let updatedUsers = 0;
  let updatedPayrolls = 0;
  let skippedUsers = 0;

  for (const [uid, sampleReport] of usersSet.entries()) {
    // Check for capital transaction added by supervisor for that user on that date
    const capital = await Transaction.findOne({
      type: 'capital',
      tellerId: uid,
      createdAt: { $gte: start, $lt: end },
      supervisorId: { $exists: true, $ne: null }
    }).lean();

    if (!capital) {
      // No supervisor-added capital for this user on that date
      skippedUsers++;
      continue;
    }

    const user = await User.findById(uid).lean();
    if (!user) {
      console.warn(`User ${uid} not found, skipping`);
      skippedUsers++;
      continue;
    }

    // If user's baseSalary is falsy (0 or missing), set to default
    if (!user.baseSalary || Number(user.baseSalary) <= 0) {
      await User.findByIdAndUpdate(uid, { $set: { baseSalary: defaultBase } });
      console.log(`Set User.baseSalary=${defaultBase} for ${user.name || user.username}`);
      updatedUsers++;
    } else {
      console.log(`User ${user.name || user.username} already has baseSalary=${user.baseSalary}`);
    }

    // Update payrolls for that date: set baseSalary where 0 and recompute totalSalary
    const payrolls = await Payroll.find({ user: uid, $or: [ { createdAt: { $gte: start, $lt: end } }, { date: dateStr } ] }).lean();
    for (const p of payrolls) {
      if (!p) continue;
      const needUpdate = !p.baseSalary || Number(p.baseSalary) <= 0;
      if (needUpdate) {
        const base = user.baseSalary && Number(user.baseSalary) > 0 ? Number(user.baseSalary) : defaultBase;
        const over = Number(p.over || 0);
        const short = Number(p.short || 0);
        const deduction = Number(p.deduction || 0);
        const total = base + over - short - deduction;
        await Payroll.findByIdAndUpdate(p._id, { $set: { baseSalary: base, totalSalary: total } });
        console.log(`Updated payroll ${p._id} for ${user.name || user.username}: base=${base} total=${total}`);
        updatedPayrolls++;
      } else {
        console.log(`Payroll ${p._id} already has baseSalary=${p.baseSalary}`);
      }
    }
  }

  console.log('\nSummary:');
  console.log(`Users with supervisor-capital on ${dateStr}: ${usersSet.size - skippedUsers}`);
  console.log(`User records updated (baseSalary set): ${updatedUsers}`);
  console.log(`Payrolls updated: ${updatedPayrolls}`);
  console.log(`Skipped users (no supervisor capital or missing user): ${skippedUsers}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
