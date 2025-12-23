// showPayrollsByDate.js
// Usage: node showPayrollsByDate.js [YYYY-MM-DD]
// Example: node showPayrollsByDate.js 2025-11-13

import mongoose from 'mongoose';
import dotenv from 'dotenv';
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
  console.log('Connected. Querying Payrolls for', dateStr);

  const start = startOfDay(dateStr);
  const end = endOfDay(dateStr);

  // Find payrolls created on that day
  const payrolls = await Payroll.find({
    $or: [
      { createdAt: { $gte: start, $lt: end } },
      { date: dateStr }
    ]
  }).populate('user').sort({ createdAt: -1 }).lean();

  console.log(`Found ${payrolls.length} payroll(s) for ${dateStr}`);

  for (const p of payrolls) {
    console.log('---');
    console.log('id:', p._id?.toString());
    console.log('userId:', p.user?._id || p.user);
    console.log('userName:', p.user?.name || p.user?.username || 'N/A');
    console.log('role:', p.role);
    console.log('baseSalary:', p.baseSalary);
    console.log('over:', p.over, 'short:', p.short);
    console.log('deduction:', p.deduction || 0);
    console.log('totalSalary:', p.totalSalary);
    console.log('createdAt:', p.createdAt);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
