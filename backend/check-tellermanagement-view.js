import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import Transaction from './models/Transaction.js';
import User from './models/User.js';

await mongoose.connect('mongodb://localhost:27017/rmi_teller_report').then(async () => {
  try {
    const now = DateTime.now().setZone("Asia/Manila");
    const todayStr = now.toFormat("yyyy-MM-dd");
    const targetDate = todayStr;
    
    console.log('\n🔍 SIMULATING TELLER MANAGEMENT VIEW FOR:', targetDate);
    
    // Get all tellers
    const tellers = await User.find({ role: "teller" }).lean();
    console.log(`\n👥 Total tellers in system: ${tellers.length}`);
    
    // Get transactions for today
    const startOfDay = new Date(targetDate + 'T00:00:00.000Z');
    const endOfDay = new Date(DateTime.fromFormat(targetDate, "yyyy-MM-dd").plus({ days: 1 }).toFormat("yyyy-MM-dd") + 'T00:00:00.000Z');
    
    const tellerIds = tellers.map(t => t._id);
    const transactions = await Transaction.find({
      tellerId: { $in: tellerIds },
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    }).lean();
    
    console.log(`\n📝 Total transactions today: ${transactions.length}`);
    
    // Group transactions by teller
    const tellerTransactionMap = {};
    transactions.forEach(t => {
      if (!tellerTransactionMap[t.tellerId]) {
        tellerTransactionMap[t.tellerId] = [];
      }
      tellerTransactionMap[t.tellerId].push(t);
    });
    
    // Show which tellers have transactions today
    console.log(`\n✅ TELLERS THAT WILL SHOW IN MANAGEMENT (with transactions today):`);
    const shownTellers = Object.keys(tellerTransactionMap);
    if (shownTellers.length > 0) {
      for (const tellerId of shownTellers) {
        const teller = tellers.find(t => t._id.toString() === tellerId);
        const txns = tellerTransactionMap[tellerId];
        const types = {};
        txns.forEach(t => {
          types[t.type] = (types[t.type] || 0) + 1;
        });
        console.log(`  ✓ ${teller?.name || teller?.username}`);
        console.log(`    Transactions: ${Object.entries(types).map(([k,v]) => `${k}(${v})`).join(', ')}`);
      }
    } else {
      console.log('  (No tellers with transactions today)');
    }
    
    console.log(`\n❌ TELLERS THAT WILL BE HIDDEN (no transactions today):`);
    const hiddenTellers = tellers.filter(t => !tellerTransactionMap[t._id]);
    if (hiddenTellers.length > 0) {
      hiddenTellers.forEach(t => {
        console.log(`  ✗ ${t.name || t.username}`);
      });
    } else {
      console.log('  (All tellers have transactions today)');
    }
    
    console.log('\n✅ Done\n');
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
  
  await mongoose.connection.close();
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
