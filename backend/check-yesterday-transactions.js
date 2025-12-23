import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';
import { DateTime } from 'luxon';

async function checkYesterdayTransactions() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    // Get yesterday's date in Manila timezone
    const yesterday = DateTime.now().setZone('Asia/Manila').minus({ days: 1 }).toFormat('yyyy-MM-dd');
    const startOfDay = DateTime.fromFormat(yesterday, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).startOf('day').toUTC();
    const endOfDay = startOfDay.plus({ days: 1 });

    console.log('Checking transactions for yesterday:', yesterday);
    console.log('Date range:', startOfDay.toISO(), 'to', endOfDay.toISO());

    const transactions = await Transaction.find({
      createdAt: { $gte: startOfDay.toJSDate(), $lt: endOfDay.toJSDate() }
    }).sort({ createdAt: -1 });

    console.log('Found', transactions.length, 'transactions for yesterday');

    if (transactions.length > 0) {
      console.log('Transaction types:');
      const types = {};
      transactions.forEach(tx => {
        types[tx.type] = (types[tx.type] || 0) + 1;
      });
      console.log(types);

      console.log('Sample transactions:');
      transactions.slice(0, 5).forEach((tx, i) => {
        console.log(`${i+1}. ${tx.tellerId} - ${tx.type} - ${tx.amount} - ${tx.note || 'no note'}`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkYesterdayTransactions();