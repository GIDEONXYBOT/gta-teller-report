import mongoose from 'mongoose';
import Capital from './models/Capital.js';

async function checkRecentCapitals() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    console.log(`Checking capital distributions since ${yesterday.toISOString().split('T')[0]}\n`);

    const capitals = await Capital.find({
      createdAt: { $gte: yesterday }
    }).populate('tellerId', 'name username').sort({ createdAt: -1 });

    console.log(`Found ${capitals.length} capital distributions:\n`);

    capitals.forEach((c, i) => {
      const teller = c.tellerId || {};
      const tellerName = teller.name || teller.username || 'Unknown';
      const date = c.createdAt.toISOString().split('T')[0];
      console.log(`${i+1}. ${tellerName} - ₱${c.amount} on ${date}`);
    });

    if (capitals.length === 0) {
      console.log('❌ No capital distributions found for recent dates.');
      console.log('This explains why no payrolls were created - the create-today-teller-payrolls.js script only runs when tellers receive capital.');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRecentCapitals();