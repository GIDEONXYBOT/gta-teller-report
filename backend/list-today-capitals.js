import mongoose from 'mongoose';
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Capital from './models/Capital.js';
import { DateTime } from 'luxon';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');
  const now = DateTime.now().setZone('Asia/Manila');
  const start = new Date(now.startOf('day').toISO());
  const end = new Date(now.endOf('day').toISO());
  const tellers = await User.find({ role: 'teller' }).select('_id name username').lean();

  const transactions = await Transaction.find({
    type: 'capital',
    createdAt: { $gte: start, $lt: end },
  }).lean();

  const capitals = await Capital.find({ status: 'active' }).lean();

  console.log(`\nCapital transactions for ${now.toFormat('yyyy-MM-dd')}: ${transactions.length}`);
  const map = new Map();
  transactions.forEach(tx => {
    const teller = tellers.find(t => t._id.toString() === tx.tellerId?.toString());
    const key = teller?.username || tx.tellerId?.toString();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(tx);
  });

  tellers.forEach(teller => {
    const txns = map.get(teller.username);
    const hasTxn = !!txns;
    const capital = capitals.find(c => c.tellerId.toString() === teller._id.toString());
    console.log(`\n${teller.name} (${teller.username}):`);
    console.log(`  Active capital: ${capital ? `₱${capital.amount} base, +₱${capital.totalAdditional || 0}, -₱${capital.totalRemitted || 0}` : 'none'}`);
    console.log(`  Capital txns today: ${hasTxn ? txns.length : 0}`);
    if (txns) {
      txns.forEach((tx, idx) => console.log(`    ${idx + 1}. ₱${tx.amount} ${tx.type} ${tx.note || ''}`));
    }
  });

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error', err);
  process.exit(1);
});