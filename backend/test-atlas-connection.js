// Simple Atlas connectivity + today summary (Asia/Manila)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Models
import Capital from './models/Capital.js';
import Transaction from './models/Transaction.js';
import User from './models/User.js';

function getManilaDateString(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(d); // YYYY-MM-DD
}

function manilaDayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00.000+08:00`);
  const end = new Date(`${dateStr}T23:59:59.999+08:00`);
  return { start, end };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI not set. Copy backend/.env.example to backend/.env and set your password.');
    process.exit(1);
  }

  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected');

  const manilaDate = getManilaDateString(new Date());
  const { start, end } = manilaDayBounds(manilaDate);
  console.log(`📅 Manila Day: ${manilaDate} (UTC range ${start.toISOString()} -> ${end.toISOString()})`);

  // Query today capitals (by createdAt) and transactions (by createdAt)
  const [capitals, transactions] = await Promise.all([
    Capital.find({ createdAt: { $gte: start, $lte: end } }).lean(),
    Transaction.find({ createdAt: { $gte: start, $lte: end } }).lean(),
  ]);

  const tellerIdsFromCap = new Set(capitals.map(c => String(c.tellerId)));
  const tellerIdsFromTx = new Set(transactions.map(t => String(t.tellerId)));
  const unionIds = new Set([...tellerIdsFromCap, ...tellerIdsFromTx]);

  const users = await User.find({ _id: { $in: [...unionIds] } }, { username: 1, name: 1, role: 1 }).lean();
  const userMap = new Map(users.map(u => [String(u._id), u]));

  console.log('\n==== Today Summary (Asia/Manila) ====');
  console.log(`Capitals today: ${capitals.length} (distinct tellers: ${tellerIdsFromCap.size})`);
  console.log(`Transactions today: ${transactions.length} (distinct tellers: ${tellerIdsFromTx.size})`);
  console.log(`Union distinct tellers: ${unionIds.size}`);

  // Print per-teller line
  console.log('\nTeller Activity:');
  for (const id of unionIds) {
    const u = userMap.get(id);
    const capCount = capitals.filter(c => String(c.tellerId) === id).length;
    const txCount = transactions.filter(t => String(t.tellerId) === id).length;
    const hasCap = capCount > 0;
    const hasTx = txCount > 0;
    const showToday = hasTx || hasCap; // mirror inclusion rule
    console.log(`- ${u?.name || u?.username || id}: caps=${capCount}, tx=${txCount}, showToday=${showToday}`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Done');
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
