// Script to fix base capital for tellers with incorrect Capital.amount
import mongoose from 'mongoose';
import Capital from '../models/Capital.js';
import User from '../models/User.js';

const MONGO_URI = 'mongodb://localhost:27017/rmi-teller-report';

async function fixBaseCapital() {
  await mongoose.connect(MONGO_URI);
  // Find Tessa and Erika by name (case-insensitive)
  const tellers = await User.find({ name: { $regex: /(tessa|erika)/i } }).lean();
  for (const teller of tellers) {
    const capitals = await Capital.find({ tellerId: teller._id, status: 'active' });
    for (const cap of capitals) {
      // Set base capital to 10,000 if greater than 10,000 or 0
      if (cap.amount > 10000 || cap.amount === 0) {
        console.log(`Fixing base capital for ${teller.name}: ${cap.amount} -> 10000`);
        await Capital.findByIdAndUpdate(cap._id, { amount: 10000 });
      }
    }
  }
  console.log('Done fixing base capital for Tessa and Erika.');
  await mongoose.disconnect();
}

fixBaseCapital().catch(err => {
  console.error('Fix failed:', err);
  process.exit(1);
});
