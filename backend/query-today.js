import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import Capital from './models/Capital.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';

await mongoose.connect('mongodb://localhost:27017/rmi_teller_report').then(async () => {
  try {
    // Get today's date in Manila timezone
    const now = DateTime.now().setZone("Asia/Manila");
    const todayStr = now.toFormat("yyyy-MM-dd");
    
    // Create date range in UTC for MongoDB query
    const today = new Date(todayStr + 'T00:00:00.000Z');
    const tomorrow = new Date(DateTime.fromFormat(todayStr, "yyyy-MM-dd").plus({ days: 1 }).toFormat("yyyy-MM-dd") + 'T00:00:00.000Z');
    
    console.log('\n📅 DATE RANGE (Manila): Today 00:00 to Tomorrow 00:00 (UTC)');
    console.log('  Today:', todayStr);
    console.log('  UTC Range:', today.toISOString(), 'to', tomorrow.toISOString());
    
    // Query Capital records - ALL records first
    const allCapitals = await Capital.find({}).lean();
    console.log('\n💰 TOTAL CAPITAL RECORDS IN DB:', allCapitals.length);
    if (allCapitals.length > 0) {
      console.log('  📌 Recent capitals:');
      allCapitals.slice(-5).forEach(c => {
        console.log(`    - Amount: ₱${c.amount}, Status: ${c.status}, Created: ${new Date(c.createdAt).toISOString()}`);
      });
    }
    
    const capitalRecords = await Capital.find({
      createdAt: { $gte: today, $lt: tomorrow }
    }).lean();
    
    console.log('\n💰 CAPITAL RECORDS CREATED TODAY (Nov 15):', capitalRecords.length);
    if (capitalRecords.length > 0) {
      for (const c of capitalRecords) {
        const teller = await User.findById(c.tellerId).lean();
        const tellerName = teller?.name || teller?.username || 'Unknown';
        console.log(`  ✓ ${tellerName} | Amount: ₱${c.amount} | Status: ${c.status} | Balance: ₱${c.balanceRemaining}`);
      }
    } else {
      console.log('  (No capital records created today)');
    }
    
    // Query Transaction records
    const allTransactions = await Transaction.find({}).lean();
    console.log('\n📋 TOTAL TRANSACTION RECORDS IN DB:', allTransactions.length);
    if (allTransactions.length > 0) {
      console.log('  📌 Recent transactions:');
      allTransactions.slice(-5).forEach(t => {
        console.log(`    - Type: ${t.type}, Amount: ₱${t.amount}, Created: ${new Date(t.createdAt).toISOString()}`);
      });
    }
    
    const transactions = await Transaction.find({
      createdAt: { $gte: today, $lt: tomorrow }
    }).lean();
    
    console.log('\n📋 TRANSACTION RECORDS TODAY (Nov 15):', transactions.length);
    if (transactions.length > 0) {
      for (const t of transactions) {
        const teller = await User.findById(t.tellerId).lean();
        const tellerName = teller?.name || teller?.username || 'Unknown';
        console.log(`  ✓ ${tellerName} | Type: ${t.type} | Amount: ₱${t.amount}`);
      }
    } else {
      console.log('  (No transactions today)');
    }
    
    console.log('\n✅ Query complete\n');
  } catch (err) {
    console.error('Query error:', err.message);
    console.error(err.stack);
  }
  
  await mongoose.connection.close();
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
