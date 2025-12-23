// createPayrollsForDate.js
// Usage: node createPayrollsForDate.js YYYY-MM-DD
// Example: node createPayrollsForDate.js 2025-11-13

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TellerReport from './models/TellerReport.js';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';
const dateArg = process.argv[2] || new Date().toISOString().split('T')[0];
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

  // Find reports that match the date field OR createdAt within the day
  const reports = await TellerReport.find({
    $or: [
      { date: dateStr },
      { createdAt: { $gte: start, $lt: end } }
    ]
  }).lean();

  console.log(`Found ${reports.length} report(s) that match ${dateStr}`);

  // Collect unique teller/user ids
  const usersMap = new Map();
  for (const r of reports) {
    const uid = (r.tellerId && String(r.tellerId)) || (r.userId && String(r.userId));
    if (!uid) continue;
    if (!usersMap.has(uid)) usersMap.set(uid, r);
  }

  console.log(`Unique users to ensure payroll: ${usersMap.size}`);

  let created = 0;
  let skipped = 0;

  for (const [uid, sampleReport] of usersMap.entries()) {
    const u = await User.findById(uid).lean();
    if (!u) {
      console.warn(`User ${uid} not found, skipping`);
      skipped++;
      continue;
    }

    // Check if payroll exists for that day for this user
    const existing = await Payroll.findOne({
      user: uid,
      createdAt: { $gte: start, $lt: end }
    }).lean();

    if (existing) {
      console.log(`Payroll already exists for ${u.name || u.username} on ${dateStr}`);
      skipped++;
      continue;
    }

    const baseSalary = Number(u.baseSalary || 0);
    // Use report over/short if present to compute totalSalary
    const over = Number(sampleReport.over || 0);
    const short = Number(sampleReport.short || 0);
    const deduction = 0;
    const totalSalary = baseSalary + over - short - deduction;

    const payrollData = {
      user: uid,
      role: u.role || 'teller',
      baseSalary,
      over,
      short,
      deduction,
      totalSalary,
      createdAt: new Date((new Date(dateStr)).toISOString()),
    };

    const newP = await Payroll.create(payrollData);
    console.log(`Created payroll for ${u.name || u.username}: base=${baseSalary} over=${over} short=${short} total=${totalSalary}`);
    created++;

    if (global.io) global.io.emit('payrollUpdated', { userId: uid, payrollId: newP._id });
  }

  console.log(`Done. Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
