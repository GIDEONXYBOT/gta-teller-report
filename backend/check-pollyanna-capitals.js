// Check Pollyanna's capital records for today
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Capital from './models/Capital.js';
import User from './models/User.js';
import { DateTime } from 'luxon';

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to Atlas\n');

  // Find Pollyanna
  const pollyanna = await User.findOne({ name: /pollyanna/i }).lean();
  if (!pollyanna) {
    console.log('❌ Pollyanna not found');
    process.exit(1);
  }

  console.log(`👤 Found: ${pollyanna.name} (ID: ${pollyanna._id})\n`);

  // Get today's date range in Manila time
  const manilaDate = DateTime.now().setZone('Asia/Manila').toFormat('yyyy-MM-dd');
  const manilaStart = DateTime.fromFormat(manilaDate, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).startOf('day');
  const manilaEnd = manilaStart.plus({ days: 1 });

  console.log(`📅 Today Manila: ${manilaDate}`);
  console.log(`   UTC range: ${manilaStart.toUTC().toISO()} -> ${manilaEnd.toUTC().toISO()}\n`);

  // Get all capital records for Pollyanna created today
  const capitals = await Capital.find({
    tellerId: pollyanna._id,
    createdAt: {
      $gte: manilaStart.toUTC().toJSDate(),
      $lt: manilaEnd.toUTC().toJSDate()
    }
  }).sort({ createdAt: 1 }).lean();

  console.log(`💰 Capital records created today: ${capitals.length}\n`);

  capitals.forEach((cap, idx) => {
    const createdManila = DateTime.fromJSDate(cap.createdAt).setZone('Asia/Manila');
    console.log(`Capital #${idx + 1}:`);
    console.log(`  ID: ${cap._id}`);
    console.log(`  Amount: ₱${cap.amount}`);
    console.log(`  Status: ${cap.status}`);
    console.log(`  Total Additional: ₱${cap.totalAdditional || 0}`);
    console.log(`  Total Remitted: ₱${cap.totalRemitted || 0}`);
    console.log(`  Balance: ₱${cap.balanceRemaining || 0}`);
    console.log(`  Created: ${createdManila.toFormat('yyyy-MM-dd HH:mm:ss')} Manila`);
    console.log(`  Supervisor: ${cap.supervisorId || 'none'}`);
    console.log('');
  });

  // Get ALL capitals for Pollyanna (not just today)
  const allCapitals = await Capital.find({ tellerId: pollyanna._id }).sort({ createdAt: -1 }).lean();
  console.log(`\n📊 Total capital records ever: ${allCapitals.length}`);
  console.log(`   Active: ${allCapitals.filter(c => c.status === 'active').length}`);
  console.log(`   Completed: ${allCapitals.filter(c => c.status === 'completed').length}`);
  console.log(`   Closed: ${allCapitals.filter(c => c.status === 'closed').length}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
