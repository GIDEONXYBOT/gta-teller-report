import mongoose from "mongoose";
import dotenv from "dotenv";
import Transaction from "./models/Transaction.js";
import User from "./models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkTodaysTellers() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log("✅ Connected to MongoDB");

    // Check today's date (November 27, 2025) - handle timezone properly
    const now = new Date();
    console.log(`🕐 Current system time: ${now.toISOString()}`);
    console.log(`📅 Current date (local): ${now.toLocaleDateString()}`);

    // Get local date components
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    // Create local date objects (not UTC)
    const today = new Date(year, month, day); // Today at midnight local time
    const tomorrow = new Date(year, month, day + 1);
    const yesterday = new Date(year, month, day - 1);

    console.log(`📅 Today (local): ${today.toLocaleDateString()}`);
    console.log(`📅 Yesterday (local): ${yesterday.toLocaleDateString()}`);
    console.log(`📅 Tomorrow (local): ${tomorrow.toLocaleDateString()}`);

    // For MongoDB queries, we need UTC dates that cover the full local day
    // If local timezone is UTC+8, then local midnight is UTC 16:00 previous day
    const timezoneOffset = now.getTimezoneOffset(); // minutes
    const offsetHours = timezoneOffset / 60;

    const todayStartUTC = new Date(today.getTime() - (offsetHours * 60 * 60 * 1000));
    const todayEndUTC = new Date(tomorrow.getTime() - (offsetHours * 60 * 60 * 1000));
    const yesterdayStartUTC = new Date(yesterday.getTime() - (offsetHours * 60 * 60 * 1000));
    const yesterdayEndUTC = new Date(today.getTime() - (offsetHours * 60 * 60 * 1000));

    console.log(`📅 Today range (UTC): ${todayStartUTC.toISOString()} to ${todayEndUTC.toISOString()}`);
    console.log(`📅 Timezone offset: ${offsetHours} hours`);

    console.log(`📅 Also checking yesterday: ${yesterday.toISOString().split('T')[0]}`);
    console.log(`📅 And tomorrow: ${tomorrow.toISOString().split('T')[0]}`);

    // Find capital transactions today
    const capitalTxns = await Transaction.find({
      type: 'capital',
      createdAt: { $gte: todayStartUTC, $lt: todayEndUTC }
    }).populate('tellerId', 'username name role baseSalary').lean();

    // Also check yesterday
    const yesterdayTxns = await Transaction.find({
      type: 'capital',
      createdAt: { $gte: yesterdayStartUTC, $lt: yesterdayEndUTC }
    }).populate('tellerId', 'username name role baseSalary').lean();

    console.log(`\n💰 Capital transactions today (Nov 27): ${capitalTxns.length}`);
    console.log(`💰 Capital transactions yesterday (Nov 26): ${yesterdayTxns.length}`);

    // Check both periods
    const allRecentTxns = [...capitalTxns, ...yesterdayTxns];
    const periodLabel = capitalTxns.length > 0 ? "today" : (yesterdayTxns.length > 0 ? "yesterday" : "recently");

    if (allRecentTxns.length > 0) {
      const uniqueTellers = new Map();

      allRecentTxns.forEach(txn => {
        if (txn.tellerId) {
          const tellerId = txn.tellerId._id.toString();
          const txnDate = new Date(txn.createdAt).toISOString().split('T')[0];
          if (!uniqueTellers.has(tellerId)) {
            uniqueTellers.set(tellerId, {
              teller: txn.tellerId,
              transactions: []
            });
          }
          uniqueTellers.get(tellerId).transactions.push({txn, date: txnDate});
        }
      });

      console.log(`\n👥 Unique tellers with capital ${periodLabel}: ${uniqueTellers.size}`);

      for (const [tellerId, data] of uniqueTellers) {
        const teller = data.teller;
        const baseSalary = teller.baseSalary || 0;
        const status = baseSalary === 0 ? '❌ ZERO BASE SALARY' : '✅ OK';
        const dates = [...new Set(data.transactions.map(t => t.date))].join(', ');
        console.log(`  ${teller.name || teller.username} (${teller.role}): ₱${baseSalary} [dates: ${dates}] ${status}`);
      }

      // Check if any of these tellers have zero base salary
      const zeroBaseTellers = Array.from(uniqueTellers.values()).filter(data => (data.teller.baseSalary || 0) === 0);

      if (zeroBaseTellers.length > 0) {
        console.log(`\n🚨 CRITICAL: ${zeroBaseTellers.length} tellers with capital ${periodLabel} have ZERO base salary!`);
        zeroBaseTellers.forEach(data => {
          console.log(`  ❌ ${data.teller.name || data.teller.username} (${data.teller.role})`);
        });
      } else {
        console.log(`\n✅ All tellers with capital ${periodLabel} have proper base salaries!`);
      }

    } else {
      console.log('📭 No capital transactions found today or yesterday.');
    }

    // Also check if there are any users with zero base salary overall
    const zeroBaseUsers = await User.find({
      $or: [
        { baseSalary: { $exists: false } },
        { baseSalary: 0 }
      ],
      role: { $nin: ['admin', 'super_admin'] }
    }).select('username name role baseSalary').lean();

    if (zeroBaseUsers.length > 0) {
      console.log(`\n🚨 Users with zero base salary (excluding admins): ${zeroBaseUsers.length}`);
      zeroBaseUsers.forEach(u => {
        console.log(`  ❌ ${u.name || u.username} (${u.role}): ₱${u.baseSalary || 0}`);
      });
    } else {
      console.log('\n✅ All non-admin users have proper base salaries.');
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

checkTodaysTellers();