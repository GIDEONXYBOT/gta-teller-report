import mongoose from "mongoose";
import dotenv from "dotenv";
import Transaction from "./models/Transaction.js";
import User from "./models/User.js"; // Import to register schema

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkRecentCapitalTransactions() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log("✅ Connected to MongoDB");

    // Check the most recent capital transactions
    const recentCapitalTxns = await Transaction.find({
      type: 'capital'
    }).populate('tellerId', 'username name role baseSalary').sort({ createdAt: -1 }).limit(20).lean();

    console.log(`\n📋 Most recent capital transactions (${recentCapitalTxns.length} shown):`);
    recentCapitalTxns.forEach((txn, i) => {
      const date = new Date(txn.createdAt).toISOString().split('T')[0] + ' ' + new Date(txn.createdAt).toISOString().split('T')[1].split('.')[0];
      const tellerName = txn.tellerId ? (txn.tellerId.name || txn.tellerId.username) : 'Unknown';
      const baseSalary = txn.tellerId ? (txn.tellerId.baseSalary || 0) : 0;
      const status = baseSalary === 0 ? '❌ ZERO BASE' : '✅ OK';
      console.log(`${i+1}. ${date} - ${tellerName} (₱${baseSalary}) - Amount: ₱${txn.amount || 0} ${status}`);
    });

    // Check total capital transactions
    const totalCapital = await Transaction.countDocuments({ type: 'capital' });
    console.log(`\n📊 Total capital transactions: ${totalCapital}`);

    // Check if there are any capital transactions in the last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const recentHourTxns = await Transaction.find({
      type: 'capital',
      createdAt: { $gte: oneHourAgo }
    }).populate('tellerId', 'username name role baseSalary').lean();

    console.log(`\n🕐 Capital transactions in last hour: ${recentHourTxns.length}`);
    if (recentHourTxns.length > 0) {
      recentHourTxns.forEach(txn => {
        const date = new Date(txn.createdAt).toISOString().split('T')[0] + ' ' + new Date(txn.createdAt).toISOString().split('T')[1].split('.')[0];
        const tellerName = txn.tellerId ? (txn.tellerId.name || txn.tellerId.username) : 'Unknown';
        const baseSalary = txn.tellerId ? (txn.tellerId.baseSalary || 0) : 0;
        console.log(`  ${date} - ${tellerName} (₱${baseSalary}) - Amount: ₱${txn.amount || 0}`);
      });
    }

    // Check if there are any capital transactions today (November 27, 2025)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    const today = new Date(year, month, day);
    const tomorrow = new Date(year, month, day + 1);

    const timezoneOffset = now.getTimezoneOffset();
    const offsetHours = timezoneOffset / 60;

    const todayStartUTC = new Date(today.getTime() - (offsetHours * 60 * 60 * 1000));
    const todayEndUTC = new Date(tomorrow.getTime() - (offsetHours * 60 * 60 * 1000));

    const todaysTxns = await Transaction.find({
      type: 'capital',
      createdAt: { $gte: todayStartUTC, $lt: todayEndUTC }
    }).populate('tellerId', 'username name role baseSalary').lean();

    console.log(`\n📅 Capital transactions today (November 27, 2025): ${todaysTxns.length}`);
    if (todaysTxns.length > 0) {
      const uniqueTellers = new Map();

      todaysTxns.forEach(txn => {
        if (txn.tellerId) {
          const tellerId = txn.tellerId._id.toString();
          if (!uniqueTellers.has(tellerId)) {
            uniqueTellers.set(tellerId, {
              teller: txn.tellerId,
              transactions: []
            });
          }
          uniqueTellers.get(tellerId).transactions.push(txn);
        }
      });

      console.log(`👥 Unique tellers with capital today: ${uniqueTellers.size}`);

      for (const [tellerId, data] of uniqueTellers) {
        const teller = data.teller;
        const baseSalary = teller.baseSalary || 0;
        const status = baseSalary === 0 ? '❌ ZERO BASE SALARY' : '✅ OK';
        console.log(`  ${teller.name || teller.username} (${teller.role}): ₱${baseSalary} [${data.transactions.length} transactions] ${status}`);
      }

      // Check if any tellers have zero base salary
      const zeroBaseTellers = Array.from(uniqueTellers.values()).filter(data => (data.teller.baseSalary || 0) === 0);

      if (zeroBaseTellers.length > 0) {
        console.log(`\n🚨 CRITICAL: ${zeroBaseTellers.length} tellers with capital today have ZERO base salary!`);
        zeroBaseTellers.forEach(data => {
          console.log(`  ❌ ${data.teller.name || data.teller.username} (${data.teller.role})`);
        });
      } else {
        console.log(`\n✅ All tellers with capital today have proper base salaries!`);
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

checkRecentCapitalTransactions();