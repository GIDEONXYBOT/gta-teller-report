import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { DateTime } from 'luxon';
import User from './models/User.js';
import Capital from './models/Capital.js';
import Transaction from './models/Transaction.js';

dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  await mongoose.connect(uri);
  const targetDate = DateTime.now().setZone('Asia/Manila').toFormat('yyyy-MM-dd');
  const start = DateTime.fromFormat(targetDate,'yyyy-MM-dd',{zone:'Asia/Manila'}).startOf('day').toUTC();
  const end = start.plus({ days:1 });

  const capitalsToday = await Capital.find({
    createdAt: { $gte: start.toJSDate(), $lt: end.toJSDate() }
  }).lean();

  const tellerIds = [...new Set(capitalsToday.map(c => c.tellerId.toString()))];
  const users = await User.find({ _id: { $in: tellerIds } }).select('_id username name').lean();

  const transactionsToday = await Transaction.find({
    createdAt: { $gte: start.toJSDate(), $lt: end.toJSDate() }
  }).lean();

  const txnMap = transactionsToday.reduce((acc, tx) => {
    const k = tx.tellerId.toString();
    acc[k] = acc[k] || [];
    acc[k].push({ type: tx.type, amount: tx.amount });
    return acc;
  }, {});

  console.log(`\n📅 Date (Manila): ${targetDate}`);
  console.log(`🧾 Capitals created today: ${capitalsToday.length}`);
  console.log(`🔁 Transactions today: ${transactionsToday.length}`);

  users.forEach(u => {
    const capital = capitalsToday.find(c => c.tellerId.toString() === u._id.toString());
    const txns = txnMap[u._id.toString()] || [];
    const completed = capital?.status === 'completed';
    console.log(`\n👤 ${u.username || u.name}`);
    console.log(`   Capital: base=₱${capital?.amount||0} additional=₱${capital?.totalAdditional||0} remitted=₱${capital?.totalRemitted||0} status=${capital?.status}`);
    console.log(`   Transactions today: ${txns.length}`);
    txns.forEach((t,i)=>console.log(`     ${i+1}. ${t.type} ₱${t.amount}`));
    console.log(`   Will appear (logic): ${completed ? (txns.length>0?'YES (completed + txn)':'NO (completed w/out txn)') : 'YES (active or txn)'}`);
  });

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });