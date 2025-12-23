import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';
import Payroll from './models/Payroll.js';

async function checkToday() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    console.log('Checking transactions and payrolls for today:', startOfDay.toISOString().split('T')[0]);

    const transactions = await Transaction.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).populate('tellerId', 'name username').populate('supervisorId', 'name username').lean();

    console.log('Capital transactions today:', transactions.length);
    transactions.forEach(t => {
      console.log(`- ${t.supervisorId?.name || t.supervisorId?.username} -> ${t.tellerId?.name || t.tellerId?.username}: ₱${t.amount}`);
    });

    const payrolls = await Payroll.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).populate('user', 'name username role').lean();

    console.log('Payrolls created today:', payrolls.length);
    payrolls.forEach(p => {
      console.log(`- ${p.user?.name || p.user?.username} (${p.role}): ₱${p.baseSalary}`);
    });

    await mongoose.disconnect();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

checkToday();