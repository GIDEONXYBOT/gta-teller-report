import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';
import User from './models/User.js';
import { DateTime } from 'luxon';

async function testAdminOverview() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    // Get tellers
    const tellers = await User.find({ role: 'teller', status: 'approved' }).select('_id').lean();
    const tellerIds = tellers.map(t => t._id);

    // Use the exact same date logic as adminTellerOverview.js
    const targetDate = DateTime.now().setZone('Asia/Manila').toFormat('yyyy-MM-dd');
    const targetDay = DateTime.fromFormat(targetDate, 'yyyy-MM-dd', { zone: 'Asia/Manila' });
    const transactionsStart = targetDay.startOf('day').toUTC();
    const transactionsEnd = transactionsStart.plus({ days: 1 });

    const transactions = await Transaction.find({
      tellerId: { $in: tellerIds },
      createdAt: {
        $gte: transactionsStart.toJSDate(),
        $lt: transactionsEnd.toJSDate()
      }
    }).lean();

    console.log('Admin overview would find', transactions.length, 'transactions for', targetDate);
    console.log('Date range:', transactionsStart.toISO(), 'to', transactionsEnd.toISO());

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testAdminOverview();