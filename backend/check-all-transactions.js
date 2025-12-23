import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';

async function checkAllTransactions() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    const totalCount = await Transaction.countDocuments();
    console.log('Total transactions in database:', totalCount);

    if (totalCount > 0) {
      const recent = await Transaction.find({}).sort({ createdAt: -1 }).limit(10);
      console.log('Most recent transactions:');
      recent.forEach((tx, i) => {
        console.log(`${i+1}. ${tx.createdAt} - ${tx.tellerId} - ${tx.type} - ${tx.amount}`);
      });

      // Check date range of all transactions
      const oldest = await Transaction.findOne({}).sort({ createdAt: 1 });
      const newest = await Transaction.findOne({}).sort({ createdAt: -1 });
      console.log('Date range:');
      console.log('Oldest:', oldest.createdAt);
      console.log('Newest:', newest.createdAt);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllTransactions();