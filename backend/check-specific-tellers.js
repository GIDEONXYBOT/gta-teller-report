// Check specific tellers' transactions and amounts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Transaction from './models/Transaction.js';
import Capital from './models/Capital.js';
import User from './models/User.js';
import { DateTime } from 'luxon';

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to Atlas\n');

  // Get today's date range in Manila time
  const manilaDate = DateTime.now().setZone('Asia/Manila').toFormat('yyyy-MM-dd');
  const manilaStart = DateTime.fromFormat(manilaDate, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).startOf('day');
  const manilaEnd = manilaStart.plus({ days: 1 });

  const tellerNames = ['honey', 'mary clarisse', 'pollyanna', 'mary gold'];
  
  for (const searchName of tellerNames) {
    const teller = await User.findOne({ name: new RegExp(searchName, 'i') }).lean();
    if (!teller) {
      console.log(`❌ ${searchName} not found\n`);
      continue;
    }

    console.log(`👤 ${teller.name} (${teller._id})`);
    console.log('─'.repeat(60));

    // Get active capital
    const capital = await Capital.findOne({ tellerId: teller._id, status: 'active' }).lean();
    if (capital) {
      console.log(`💰 Active Capital:`);
      console.log(`   Base Amount: ₱${capital.amount?.toLocaleString() || 0}`);
      console.log(`   Total Additional: ₱${capital.totalAdditional?.toLocaleString() || 0}`);
      console.log(`   Total Remitted: ₱${capital.totalRemitted?.toLocaleString() || 0}`);
      console.log(`   Balance: ₱${capital.balanceRemaining?.toLocaleString() || 0}`);
    } else {
      console.log('   No active capital');
    }

    // Get today's transactions
    const transactions = await Transaction.find({
      tellerId: teller._id,
      createdAt: {
        $gte: manilaStart.toUTC().toJSDate(),
        $lt: manilaEnd.toUTC().toJSDate()
      }
    }).sort({ createdAt: 1 }).lean();

    console.log(`\n📝 Transactions Today (${transactions.length}):`);
    
    const additional = transactions.filter(t => t.type === 'additional');
    const remittance = transactions.filter(t => t.type === 'remittance');
    
    if (additional.length > 0) {
      console.log(`\n   Additional (${additional.length}):`);
      additional.forEach(tx => {
        const time = DateTime.fromJSDate(tx.createdAt).setZone('Asia/Manila').toFormat('HH:mm:ss');
        console.log(`     - ₱${tx.amount?.toLocaleString() || 0} at ${time} (note: ${tx.note || 'none'})`);
      });
      const additionalTotal = additional.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      console.log(`     Total Additional Today: ₱${additionalTotal.toLocaleString()}`);
    }
    
    if (remittance.length > 0) {
      console.log(`\n   Remittance (${remittance.length}):`);
      remittance.forEach(tx => {
        const time = DateTime.fromJSDate(tx.createdAt).setZone('Asia/Manila').toFormat('HH:mm:ss');
        console.log(`     - ₱${tx.amount?.toLocaleString() || 0} at ${time} (note: ${tx.note || 'none'})`);
      });
      const remittanceTotal = remittance.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      console.log(`     Total Remittance Today: ₱${remittanceTotal.toLocaleString()}`);
    }
    
    console.log('\n');
  }

  await mongoose.disconnect();
  console.log('✅ Done');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
