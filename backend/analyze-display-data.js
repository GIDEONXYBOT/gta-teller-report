import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import Capital from './models/Capital.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';

await mongoose.connect('mongodb://localhost:27017/rmi_teller_report').then(async () => {
  try {
    const now = DateTime.now().setZone("Asia/Manila");
    const targetDate = now.toFormat("yyyy-MM-dd");
    
    console.log(`\n🔍 ANALYZING DATA FOR: ${targetDate}\n`);
    
    // Get all tellers
    const tellers = await User.find({ role: 'teller' }).lean();
    const tellerIds = tellers.map(t => t._id);
    
    // Get capitals
    const capitals = await Capital.find({ tellerId: { $in: tellerIds } }).lean();
    
    // Get transactions for today
    const queryStart = new Date(targetDate + 'T00:00:00.000Z');
    const queryEnd = new Date(DateTime.fromFormat(targetDate, "yyyy-MM-dd").plus({ days: 1 }).toFormat("yyyy-MM-dd") + 'T00:00:00.000Z');
    
    const transactions = await Transaction.find({
      tellerId: { $in: tellerIds },
      createdAt: {
        $gte: queryStart,
        $lt: queryEnd
      }
    }).lean();
    
    console.log(`📋 Total tellers: ${tellers.length}`);
    console.log(`📋 Total capitals: ${capitals.length}`);
    console.log(`📋 Total transactions for today: ${transactions.length}\n`);
    
    // Analyze each teller
    tellers.forEach(teller => {
      const tellerCap = capitals.find(c => c.tellerId.toString() === teller._id.toString());
      const tellerTxns = transactions.filter(t => t.tellerId.toString() === teller._id.toString());
      
      console.log(`\n👤 ${teller.name}:`);
      console.log(`   Capital: ${tellerCap ? `₱${tellerCap.amount} (base) + ₱${tellerCap.totalAdditional || 0} (additional) - ₱${tellerCap.totalRemitted || 0} (remitted)` : 'NONE'}`);
      console.log(`   Transactions today: ${tellerTxns.length}`);
      
      if (tellerTxns.length > 0) {
        const byType = {};
        tellerTxns.forEach(t => {
          if (!byType[t.type]) byType[t.type] = { count: 0, total: 0 };
          byType[t.type].count++;
          byType[t.type].total += t.amount;
        });
        
        Object.entries(byType).forEach(([type, data]) => {
          console.log(`     - ${type}: ${data.count} txn(s), ₱${data.total} total`);
        });
      }
      
      console.log(`   Show in list? ${tellerTxns.length > 0 ? '✅ YES' : '❌ NO'}`);
    });
    
    console.log('\n✅ Done\n');
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await mongoose.connection.close();
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
