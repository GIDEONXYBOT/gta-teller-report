import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkTransactions() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report');

    // Find Ramesh
    const ramesh = await User.findOne({ username: 'Ramesh' }).lean();
    if (!ramesh) {
      console.log('Ramesh not found');
      return;
    }
    console.log('Ramesh ID:', ramesh._id);

    // Find Apple
    const apple = await User.findOne({ username: 'apple' }).lean();
    if (!apple) {
      console.log('Apple not found');
      return;
    }
    console.log('Apple ID:', apple._id);

    // Find transactions where Ramesh is supervisor
    const transactions = await Transaction.find({
      supervisorId: ramesh._id
    }).sort({ createdAt: -1 }).limit(10).lean();

    console.log('Recent transactions by Ramesh:');
    transactions.forEach(t => {
      console.log(`  ${t.createdAt} - Type: ${t.type}, Teller: ${t.tellerId}, Amount: ${t.amount}`);
    });

    // Check if Apple received capital from Ramesh
    const appleTransactions = await Transaction.find({
      supervisorId: ramesh._id,
      tellerId: apple._id
    }).lean();

    console.log(`Transactions from Ramesh to Apple: ${appleTransactions.length}`);
    appleTransactions.forEach(t => {
      console.log(`  ${t.createdAt} - Type: ${t.type}, Amount: ${t.amount}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkTransactions();