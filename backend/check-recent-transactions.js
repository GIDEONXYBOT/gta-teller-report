import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';
import { DateTime } from 'luxon';

async function checkAllRecentTransactions() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    console.log('Checking all transactions from the last 7 days...');

    const sevenDaysAgo = DateTime.now().minus({ days: 7 }).toJSDate();

    const transactions = await Transaction.find({
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: -1 }).limit(50);

    console.log('Found', transactions.length, 'transactions in the last 7 days');

    if (transactions.length > 0) {
      console.log('Most recent transactions:');
      transactions.slice(0, 10).forEach((tx, i) => {
        const date = DateTime.fromJSDate(tx.createdAt).setZone('Asia/Manila').toFormat('yyyy-MM-dd HH:mm:ss');
        console.log(`${i+1}. ${date} - ${tx.tellerId} - ${tx.type} - ${tx.amount} - ${tx.note || 'no note'}`);
      });

      // Group by date
      const byDate = {};
      transactions.forEach(tx => {
        const date = DateTime.fromJSDate(tx.createdAt).setZone('Asia/Manila').toFormat('yyyy-MM-dd');
        if (!byDate[date]) byDate[date] = 0;
        byDate[date]++;
      });

      console.log('Transactions by date:');
      Object.entries(byDate).sort().forEach(([date, count]) => {
        console.log(`  ${date}: ${count} transactions`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllRecentTransactions();