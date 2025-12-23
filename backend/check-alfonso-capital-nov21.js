import mongoose from 'mongoose';
import Capital from './models/Capital.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function checkAlfonsoCapitalOnNov21() {
  try {
    await mongoose.connect(MONGO_URI);

    // Find Alfonso
    const alfonso = await User.findOne({ username: "Alfonso" }).lean();
    if (!alfonso) {
      console.log("Alfonso not found");
      return;
    }

    console.log(`Found Alfonso: ${alfonso.name} (${alfonso._id})`);

    // Check capital additions on November 21, 2025
    const nov21Start = new Date('2025-11-21T00:00:00.000Z');
    const nov21End = new Date('2025-11-21T23:59:59.999Z');

    const capitalRecords = await Capital.find({
      supervisorId: alfonso._id,
      createdAt: { $gte: nov21Start, $lte: nov21End }
    })
    .populate('tellerId', 'name username')
    .sort({ createdAt: 1 })
    .lean();

    console.log(`\nCapital additions by Alfonso on November 21, 2025: ${capitalRecords.length}`);

    capitalRecords.forEach((record, i) => {
      console.log(`${i+1}. ${record.createdAt} - Added ₱${record.amount} to ${record.tellerId?.name || 'Unknown'} (${record.tellerId?.username || 'Unknown'})`);
    });

    // Check if there were multiple capital additions at the same time
    const timestamps = capitalRecords.map(r => r.createdAt.getTime());
    const uniqueTimestamps = [...new Set(timestamps)];

    console.log(`\nUnique timestamps: ${uniqueTimestamps.length}`);
    uniqueTimestamps.forEach(ts => {
      const count = timestamps.filter(t => t === ts).length;
      if (count > 1) {
        console.log(`Timestamp ${new Date(ts)}: ${count} capital additions`);
      }
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkAlfonsoCapitalOnNov21();