import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import Transaction from './models/Transaction.js';
import User from './models/User.js';
import Capital from './models/Capital.js';

await mongoose.connect('mongodb://localhost:27017/rmi_teller_report').then(async () => {
  try {
    const now = DateTime.now().setZone("Asia/Manila");
    const targetDate = now.toFormat("yyyy-MM-dd");
    
    console.log(`\n🔍 SIMULATING ADMIN QUERY FOR: ${targetDate}`);
    console.log(`Manila time: ${now.toISO()}`);
    
    // Get all tellers
    const tellers = await User.find({ role: 'teller' }).select('_id name').lean();
    const tellerIds = tellers.map(t => t._id);
    
    console.log(`\n👥 Found ${tellers.length} tellers`);
    
    // Query exactly as adminTellerOverview does
    const queryStart = new Date(targetDate + 'T00:00:00.000Z');
    const queryEnd = new Date(DateTime.fromFormat(targetDate, "yyyy-MM-dd").plus({ days: 1 }).toFormat("yyyy-MM-dd") + 'T00:00:00.000Z');
    
    console.log(`\n🔍 QUERY PARAMETERS:`);
    console.log(`  Start: ${queryStart.toISOString()} (UTC)`);
    console.log(`  End:   ${queryEnd.toISOString()} (UTC)`);
    console.log(`  Start (local): ${new Date(queryStart).toLocaleString()}`);
    console.log(`  End (local):   ${new Date(queryEnd).toLocaleString()}`);
    
    const transactions = await Transaction.find({
      tellerId: { $in: tellerIds },
      createdAt: {
        $gte: queryStart,
        $lt: queryEnd
      }
    }).lean();
    
    console.log(`\n📋 Found ${transactions.length} transactions for ${targetDate}`);
    
    if (transactions.length > 0) {
      const types = transactions.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {});
      console.log(`📊 Transaction types:`, types);
      
      console.log(`\n📝 Sample transactions:`);
      transactions.slice(0, 3).forEach((t, i) => {
        console.log(`  ${i+1}. Type: ${t.type}, Amount: ₱${t.amount}, Created: ${t.createdAt.toISOString()}`);
      });
    }
    
    console.log('\n✅ Done\n');
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await mongoose.connection.close();
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
