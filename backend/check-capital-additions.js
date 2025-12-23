import mongoose from 'mongoose';
import Capital from './models/Capital.js';
import User from './models/User.js';

async function checkCapitalAdditions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');

    // Find all capital records
    const capitals = await Capital.find({})
      .populate('supervisorId', 'name username role')
      .populate('tellerId', 'name username role')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    console.log(`Found ${capitals.length} capital records (showing last 20):`);
    capitals.forEach(c => {
      console.log(`  - ${c.createdAt}: ${c.supervisorId?.name || 'Unknown'} added ₱${c.amount} to ${c.tellerId?.name || 'Unknown'}`);
    });

    // Check specifically for Nov 21
    const nov21Start = new Date('2024-11-21T00:00:00.000Z');
    const nov21End = new Date('2024-11-21T23:59:59.999Z');

    const nov21Capitals = await Capital.find({
      createdAt: { $gte: nov21Start, $lte: nov21End }
    })
      .populate('supervisorId', 'name username role')
      .populate('tellerId', 'name username role')
      .lean();

    console.log(`\nFound ${nov21Capitals.length} capital records for Nov 21:`);
    nov21Capitals.forEach(c => {
      console.log(`  - ${c.createdAt}: ${c.supervisorId?.name || 'Unknown'} added ₱${c.amount} to ${c.tellerId?.name || 'Unknown'}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkCapitalAdditions();