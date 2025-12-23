import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import Capital from './models/Capital.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';

await mongoose.connect('mongodb://localhost:27017/rmi_teller_report').then(async () => {
  try {
    const now = DateTime.now().setZone("Asia/Manila");
    const todayStr = now.toFormat("yyyy-MM-dd");
    const targetDate = todayStr;
    
    console.log('\n📅 Checking admin teller overview for:', targetDate);
    
    // Get all tellers
    const tellers = await User.find({ role: "teller", status: "approved" }).lean();
    console.log(`\n👥 Total tellers found: ${tellers.length}`);
    
    if (tellers.length > 0) {
      tellers.forEach(t => {
        console.log(`  - ${t.name || t.username}`);
      });
    }
    
    const tellerIds = tellers.map(t => t._id);
    
    // Get teller reports for today
    const tellerReports = await mongoose.connection.db.collection('tellerreports').find({
      tellerId: { $in: tellerIds },
      date: targetDate
    }).toArray();
    
    console.log(`\n📋 Teller reports for ${targetDate}: ${tellerReports.length}`);
    if (tellerReports.length > 0) {
      tellerReports.slice(0, 3).forEach(r => {
        console.log(`  - ${r.userId}: systemBalance ₱${r.systemBalance}, cashOnHand ₱${r.cashOnHand}`);
      });
    }
    
    // Get active capitals
    const activeCapitals = await Capital.find({
      tellerId: { $in: tellerIds },
      status: "active"
    }).lean();
    
    console.log(`\n💰 Active capital records: ${activeCapitals.length}`);
    if (activeCapitals.length > 0) {
      activeCapitals.forEach(c => {
        const teller = tellers.find(t => t._id.toString() === c.tellerId.toString());
        console.log(`  - ${teller?.name || teller?.username}: ₱${c.amount}, totalRemitted: ₱${c.totalRemitted}`);
      });
    }
    
    // Get transactions for today
    const startOfDay = new Date(targetDate + 'T00:00:00.000Z');
    const endOfDay = new Date(DateTime.fromFormat(targetDate, "yyyy-MM-dd").plus({ days: 1 }).toFormat("yyyy-MM-dd") + 'T00:00:00.000Z');
    
    const transactions = await Transaction.find({
      tellerId: { $in: tellerIds },
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    }).lean();
    
    console.log(`\n📝 Transactions for ${targetDate}: ${transactions.length}`);
    if (transactions.length > 0) {
      const grouped = {};
      transactions.forEach(t => {
        grouped[t.type] = (grouped[t.type] || 0) + 1;
      });
      console.log(`  Types:`, grouped);
      transactions.slice(0, 5).forEach(t => {
        const teller = tellers.find(te => te._id.toString() === t.tellerId.toString());
        console.log(`    - ${teller?.name || t.tellerId}: ${t.type} ₱${t.amount}`);
      });
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
