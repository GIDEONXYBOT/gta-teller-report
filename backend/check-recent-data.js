import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';
import Payroll from './models/Payroll.js';

async function checkRecent() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));

    console.log('Checking transactions and payrolls for the last 3 days:');

    const transactions = await Transaction.find({
      createdAt: { $gte: threeDaysAgo }
    }).populate('tellerId', 'name username').populate('supervisorId', 'name username').sort({ createdAt: -1 }).lean();

    console.log(`\nCapital transactions in last 3 days: ${transactions.length}`);
    transactions.forEach(t => {
      const date = t.createdAt.toISOString().split('T')[0];
      console.log(`- ${date}: ${t.supervisorId?.name || t.supervisorId?.username} -> ${t.tellerId?.name || t.tellerId?.username}: ₱${t.amount}`);
    });

    const payrolls = await Payroll.find({
      createdAt: { $gte: threeDaysAgo }
    }).populate('user', 'name username role').sort({ createdAt: -1 }).lean();

    console.log(`\nPayrolls created in last 3 days: ${payrolls.length}`);
    payrolls.forEach(p => {
      const date = p.createdAt.toISOString().split('T')[0];
      console.log(`- ${date}: ${p.user?.name || p.user?.username} (${p.role}): ₱${p.baseSalary}`);
    });

    await mongoose.disconnect();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

checkRecent();