import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';
import { DateTime } from 'luxon';

async function testCreateTransaction() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    // Create a test transaction for today
    const now = new Date();
    console.log('Creating transaction at:', now);

    const transaction = await Transaction.create({
      supervisorId: '6915632eae8518585e950662',
      tellerId: '6915632eae8518585e950664',
      type: 'capital',
      amount: 1000,
      performedBy: 'Test User',
      note: 'Test transaction for today',
      createdAt: now
    });

    console.log('Created transaction:', transaction);

    // Check if it appears in today's query
    const today = DateTime.now().setZone('Asia/Manila').toFormat('yyyy-MM-dd');
    const startOfDay = DateTime.fromFormat(today, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).startOf('day').toUTC();
    const endOfDay = startOfDay.plus({ days: 1 });

    const todayTransactions = await Transaction.find({
      createdAt: { $gte: startOfDay.toJSDate(), $lt: endOfDay.toJSDate() }
    });

    console.log('Transactions found for today after creation:', todayTransactions.length);
    todayTransactions.forEach(tx => {
      console.log('Transaction:', tx.createdAt, tx.type, tx.amount);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testCreateTransaction();