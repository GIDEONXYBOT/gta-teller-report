import mongoose from 'mongoose';
import User from './models/User.js';
import Capital from './models/Capital.js';
import Transaction from './models/Transaction.js';
import { DateTime } from 'luxon';

const tellerNames = [
  '@PAO', '@clarissep.21', '@Trexie', '@006erika', '@mburadia29', '@Maria', '@023jenessa', '@Honey018', '@Marebelen12', '@015.mitch'
];

async function main() {
  await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');
  const users = await User.find({ username: { $in: tellerNames } }).lean();
  console.log('Found tellers:', users.map(u => `${u.username} (${u._id})`));

  const now = DateTime.now().setZone('Asia/Manila');
  const start = now.startOf('day').toUTC().toJSDate();
  const end = now.endOf('day').toUTC().toJSDate();

  for (const teller of users) {
    const capital = await Capital.findOne({ tellerId: teller._id, status: 'active' }).lean();
    const transactions = await Transaction.find({
      tellerId: teller._id,
      createdAt: { $gte: start, $lt: end }
    }).lean();

    console.log(`\n${teller.username} (${teller.name})`);
    console.log(`  Active capital: ${capital ? `₱${capital.amount}/+${capital.totalAdditional || 0}/- ${capital.totalRemitted || 0}` : 'none'}`);
    console.log(`  Today txns: ${transactions.length}`);
    transactions.forEach(tx => console.log(`    - ${tx.type} ₱${tx.amount} ${tx.note || ''}`));
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });