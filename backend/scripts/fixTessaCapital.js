// Script to fix Tessa's base capital to 10,000 and remove additional from base
import mongoose from 'mongoose';
import Capital from '../models/Capital.js';
import User from '../models/User.js';

const MONGO_URI = 'mongodb://localhost:27017/rmi-teller-report';

async function fixTessaCapital() {
  await mongoose.connect(MONGO_URI);
  const tessa = await User.findOne({ name: /tessa/i });
  if (!tessa) {
    console.log('Tessa not found');
    await mongoose.disconnect();
    return;
  }
  const records = await Capital.find({ tellerId: tessa._id }).lean();
  for (const record of records) {
    if (record.amount > 10000) {
      console.log('Fixing record:', record);
      await Capital.findByIdAndUpdate(record._id, { amount: 10000, note: 'Base capital only' });
    }
  }
  console.log('Done fixing Tessa base capital.');
  await mongoose.disconnect();
}

fixTessaCapital().catch(err => {
  console.error('Fix failed:', err);
  process.exit(1);
});
