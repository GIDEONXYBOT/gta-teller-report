import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import Transaction from './models/Transaction.js';
import User from './models/User.js';

await mongoose.connect('mongodb://localhost:27017/rmi_teller_report').then(async () => {
  try {
    const now = DateTime.now().setZone("Asia/Manila");
    const todayStr = now.toFormat("yyyy-MM-dd");
    const targetDate = todayStr;
    
    console.log('\n🔍 DETAILED TRANSACTION CHECK FOR:', targetDate);
    console.log('Manila time now:', now.toISO());
    
    // Get ALL transactions first
    const allTxns = await Transaction.find({}).lean();
    console.log(`\n📝 TOTAL TRANSACTIONS IN DB: ${allTxns.length}`);
    
    if (allTxns.length > 0) {
      console.log('\n📋 Sample transactions with timestamps:');
      allTxns.slice(0, 5).forEach(t => {
        const teller = t.tellerId ? t.tellerId.toString().substring(0, 8) : 'unknown';
        console.log(`  - Type: ${t.type}, Amount: ${t.amount}, Created: ${t.createdAt} (${new Date(t.createdAt).toISOString()})`);
      });
    }
    
    // Now test the date range query
    const startOfDay = new Date(targetDate + 'T00:00:00.000Z');
    const endOfDay = new Date(DateTime.fromFormat(targetDate, "yyyy-MM-dd").plus({ days: 1 }).toFormat("yyyy-MM-dd") + 'T00:00:00.000Z');
    
    console.log(`\n🔍 DATE RANGE FOR QUERY:`);
    console.log(`  Start: ${startOfDay.toISOString()}`);
    console.log(`  End:   ${endOfDay.toISOString()}`);
    
    const tellers = await User.find({ role: "teller" }).lean();
    const tellerIds = tellers.map(t => t._id);
    
    const todayTxns = await Transaction.find({
      tellerId: { $in: tellerIds },
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    }).lean();
    
    console.log(`\n📋 TRANSACTIONS FOR ${targetDate}: ${todayTxns.length}`);
    
    if (todayTxns.length > 0) {
      console.log('\n✅ TRANSACTIONS FOUND:');
      todayTxns.forEach(t => {
        const teller = tellers.find(te => te._id.toString() === t.tellerId.toString());
        console.log(`  - ${teller?.name || 'Unknown'}: ${t.type} ₱${t.amount} at ${new Date(t.createdAt).toISOString()}`);
      });
    } else {
      console.log('\n❌ No transactions in this date range');
      console.log('\n📌 Let me check what timestamps exist:');
      if (allTxns.length > 0) {
        const dates = allTxns.map(t => new Date(t.createdAt).toISOString().split('T')[0]);
        const uniqueDates = [...new Set(dates)];
        console.log('Dates with transactions:', uniqueDates);
      }
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
