import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';
import { DateTime } from 'luxon';

async function checkCurrentServerState() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    // Check today's date
    const today = DateTime.now().setZone('Asia/Manila').toFormat('yyyy-MM-dd');
    console.log('Today is:', today);

    // Check if there are any transactions for today
    const startOfDay = DateTime.fromFormat(today, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).startOf('day').toUTC();
    const endOfDay = startOfDay.plus({ days: 1 });

    const todayTransactions = await Transaction.find({
      createdAt: { $gte: startOfDay.toJSDate(), $lt: endOfDay.toJSDate() }
    });

    console.log('Transactions for today:', todayTransactions.length);

    // Check yesterday
    const yesterday = DateTime.now().setZone('Asia/Manila').minus({ days: 1 }).toFormat('yyyy-MM-dd');
    const yesterdayStart = DateTime.fromFormat(yesterday, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).startOf('day').toUTC();
    const yesterdayEnd = yesterdayStart.plus({ days: 1 });

    const yesterdayTransactions = await Transaction.find({
      createdAt: { $gte: yesterdayStart.toJSDate(), $lt: yesterdayEnd.toJSDate() }
    });

    console.log('Transactions for yesterday (' + yesterday + '):', yesterdayTransactions.length);

    // Check total transactions
    const total = await Transaction.countDocuments();
    console.log('Total transactions in database:', total);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCurrentServerState();