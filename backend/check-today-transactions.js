import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';
import { DateTime } from 'luxon';

async function checkTodayTransactions() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    // Get today's date in Manila timezone
    const today = DateTime.now().setZone('Asia/Manila').toFormat('yyyy-MM-dd');
    const startOfDay = DateTime.fromFormat(today, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).startOf('day').toUTC();
    const endOfDay = startOfDay.plus({ days: 1 });

    console.log('Checking transactions for today:', today);
    console.log('Date range:', startOfDay.toISO(), 'to', endOfDay.toISO());

    const transactions = await Transaction.find({
      createdAt: { $gte: startOfDay.toJSDate(), $lt: endOfDay.toJSDate() }
    }).sort({ createdAt: -1 });

    console.log('Found', transactions.length, 'transactions for today');

    if (transactions.length > 0) {
      transactions.forEach((tx, i) => {
        console.log(`${i+1}. ${tx.tellerId} - ${tx.type} - ${tx.amount} - ${tx.createdAt} - ${tx.note || 'no note'}`);
      });
    } else {
      console.log('No transactions found for today. Checking recent transactions...');
      const recent = await Transaction.find({}).sort({ createdAt: -1 }).limit(10);
      console.log('Recent transactions:');
      recent.forEach((tx, i) => {
        const date = DateTime.fromJSDate(tx.createdAt).setZone('Asia/Manila').toFormat('yyyy-MM-dd HH:mm:ss');
        console.log(`${i+1}. ${date} - ${tx.tellerId} - ${tx.type} - ${tx.amount}`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTodayTransactions();