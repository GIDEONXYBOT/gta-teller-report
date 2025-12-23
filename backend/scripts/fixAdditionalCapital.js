// Script to fix capital records that incorrectly include additional capital
import mongoose from 'mongoose';
import Capital from '../models/Capital.js';
import Transaction from '../models/Transaction.js';

const MONGO_URI = 'mongodb://localhost:27017/rmi-teller-report';

async function fixAdditionalCapital() {
  await mongoose.connect(MONGO_URI);
  const capitals = await Capital.find({ status: 'active' }).lean();
  let fixed = 0;
  for (const cap of capitals) {
    // Find additional transactions for this teller and date
    const additionalTx = await Transaction.find({
      tellerId: cap.tellerId,
      type: 'additional',
      createdAt: { $gte: cap.createdAt, $lt: new Date(new Date(cap.createdAt).getTime() + 24*60*60*1000) }
    });
    if (additionalTx.length > 0 && cap.amount > 10000) { // assuming base should be 10000
      const base = 10000;
      console.log(`Fixing capital for teller ${cap.tellerId}: ${cap.amount} -> ${base}`);
      await Capital.findByIdAndUpdate(cap._id, { amount: base });
      fixed++;
    }
  }
  console.log(`Fixed ${fixed} capital records.`);
  await mongoose.disconnect();
}

fixAdditionalCapital().catch(err => {
  console.error('Fix failed:', err);
  process.exit(1);
});
