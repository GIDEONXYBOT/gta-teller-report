import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';
import { DateTime } from 'luxon';

async function checkAdminOverviewLogic() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    // Get all tellers
    const User = (await import('./models/User.js')).default;
    const tellers = await User.find({
      role: "teller",
      status: "approved"
    }).select("_id").lean();

    const tellerIds = tellers.map(t => t._id);

    console.log(`Found ${tellers.length} tellers`);

    // Use the exact same date logic as adminTellerOverview.js
    const targetDate = '2025-11-21'; // The date from the logs
    const targetDay = DateTime.fromFormat(targetDate, "yyyy-MM-dd", { zone: "Asia/Manila" });
    const transactionsStart = targetDay.startOf("day").toUTC();
    const transactionsEnd = transactionsStart.plus({ days: 1 });

    console.log(`Date range: ${transactionsStart.toISO()} to ${transactionsEnd.toISO()}`);

    const transactions = await Transaction.find({
      tellerId: { $in: tellerIds },
      createdAt: {
        $gte: transactionsStart.toJSDate(),
        $lt: transactionsEnd.toJSDate()
      }
    }).lean();

    console.log(`Found ${transactions.length} transactions for ${targetDate}`);

    if (transactions.length > 0) {
      const types = {};
      transactions.forEach(tx => {
        types[tx.type] = (types[tx.type] || 0) + 1;
      });
      console.log('Transaction types:', types);

      console.log('Sample transactions:');
      transactions.slice(0, 3).forEach((tx, i) => {
        console.log(`${i+1}. ${tx.tellerId} - ${tx.type} - ${tx.amount} - ${tx.createdAt}`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAdminOverviewLogic();