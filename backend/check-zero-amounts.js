// Check transactions with zero amounts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Transaction from './models/Transaction.js';
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

  console.log(`📅 Today Manila: ${manilaDate}`);
  console.log(`   UTC range: ${manilaStart.toUTC().toISO()} -> ${manilaEnd.toUTC().toISO()}\n`);

  // Get all transactions today
  const transactions = await Transaction.find({
    createdAt: {
      $gte: manilaStart.toUTC().toJSDate(),
      $lt: manilaEnd.toUTC().toJSDate()
    }
  }).sort({ createdAt: 1 }).lean();

  console.log(`📊 Total transactions today: ${transactions.length}\n`);

  // Get teller info
  const tellerIds = [...new Set(transactions.map(t => String(t.tellerId)))];
  const users = await User.find({ _id: { $in: tellerIds } }).lean();
  const userMap = new Map(users.map(u => [String(u._id), u]));

  // Group by type
  const byType = {
    capital: transactions.filter(t => t.type === 'capital'),
    additional: transactions.filter(t => t.type === 'additional'),
    remittance: transactions.filter(t => t.type === 'remittance'),
    other: transactions.filter(t => !['capital', 'additional', 'remittance'].includes(t.type))
  };

  console.log('Transaction counts by type:');
  console.log(`  Capital: ${byType.capital.length}`);
  console.log(`  Additional: ${byType.additional.length}`);
  console.log(`  Remittance: ${byType.remittance.length}`);
  console.log(`  Other: ${byType.other.length}\n`);

  // Check for zero amounts
  const zeroAmounts = transactions.filter(t => !t.amount || t.amount === 0);
  console.log(`⚠️  Transactions with zero/missing amount: ${zeroAmounts.length}\n`);

  if (zeroAmounts.length > 0) {
    console.log('Transactions with zero amounts:');
    zeroAmounts.forEach(tx => {
      const user = userMap.get(String(tx.tellerId));
      const time = DateTime.fromJSDate(tx.createdAt).setZone('Asia/Manila').toFormat('HH:mm:ss');
      console.log(`  - ${user?.name || tx.tellerId} | ${tx.type} | amount: ${tx.amount} | time: ${time}`);
    });
    console.log('');
  }

  // Show sample additional and remittance transactions
  console.log('\n📋 Sample Additional Transactions:');
  byType.additional.slice(0, 5).forEach(tx => {
    const user = userMap.get(String(tx.tellerId));
    const time = DateTime.fromJSDate(tx.createdAt).setZone('Asia/Manila').toFormat('HH:mm:ss');
    console.log(`  ${user?.name || tx.tellerId}: ₱${tx.amount || 0} at ${time}`);
  });

  console.log('\n📋 Sample Remittance Transactions:');
  byType.remittance.slice(0, 5).forEach(tx => {
    const user = userMap.get(String(tx.tellerId));
    const time = DateTime.fromJSDate(tx.createdAt).setZone('Asia/Manila').toFormat('HH:mm:ss');
    console.log(`  ${user?.name || tx.tellerId}: ₱${tx.amount || 0} at ${time}`);
  });

  await mongoose.disconnect();
  console.log('\n✅ Done');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
