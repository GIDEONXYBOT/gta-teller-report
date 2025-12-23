import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Transaction from "./models/Transaction.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkTellersWithCapitalToday() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log("✅ Connected to MongoDB");

    // Get today's date and yesterday's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log(`\n📅 Checking for dates: ${yesterday.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);

    // Check total capital transactions in the database
    const totalCapitalTxns = await Transaction.countDocuments({ type: 'capital' });
    console.log(`\n📊 Total capital transactions in database: ${totalCapitalTxns}`);

    if (totalCapitalTxns === 0) {
      console.log('⚠️  No capital transactions found in the database at all!');
      return;
    }

    // Get the most recent capital transactions
    const recentCapitalTxns = await Transaction.find({
      type: 'capital'
    }).populate('tellerId', 'username name role baseSalary').sort({ createdAt: -1 }).limit(10).lean();

    console.log(`\n🕐 Most recent capital transactions:`);
    recentCapitalTxns.forEach(txn => {
      const txnDate = new Date(txn.createdAt).toISOString().split('T')[0];
      const tellerName = txn.tellerId ? (txn.tellerId.name || txn.tellerId.username) : 'Unknown';
      const baseSalary = txn.tellerId ? (txn.tellerId.baseSalary || 0) : 0;
      console.log(`  ${txnDate}: ${tellerName} - ₱${baseSalary}`);
    });

    // Find all users with baseSalary = 0 (excluding admins)
    const usersWithZeroBase = await User.find({
      $or: [
        { baseSalary: { $exists: false } },
        { baseSalary: 0 }
      ],
      role: { $nin: ['admin', 'super_admin'] }
    }).select('username name role baseSalary').lean();

    console.log(`\n🚨 Users with baseSalary = 0 (excluding admins) (${usersWithZeroBase.length} users):`);
    usersWithZeroBase.forEach(user => {
      console.log(`  ${user.name || user.username} (${user.role}): ₱${user.baseSalary || 0}`);
    });

    // Check if any of the zero-base-salary users had capital today
    const zeroBaseTellersWithCapital = usersWithZeroBase.filter(user =>
      capitalTxns.some(txn => txn.tellerId && txn.tellerId._id.toString() === user._id.toString())
    );

    if (zeroBaseTellersWithCapital.length > 0) {
      console.log(`\n⚠️  CRITICAL: ${zeroBaseTellersWithCapital.length} tellers with ZERO base salary had capital added today!`);
      zeroBaseTellersWithCapital.forEach(user => {
        console.log(`  ❌ ${user.name || user.username} (${user.role})`);
      });
    } else {
      console.log(`\n✅ No tellers with zero base salary had capital added today.`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

checkTellersWithCapitalToday();