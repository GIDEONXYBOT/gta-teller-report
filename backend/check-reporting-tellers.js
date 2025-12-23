import mongoose from 'mongoose';
import User from './models/User.js';

async function checkTellers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi-teller-report');
    console.log('✅ Connected to database');

    const count = await User.countDocuments({ role: 'teller', status: 'approved' });
    console.log(`📊 Total approved tellers in reporting system: ${count}`);

    const tellers = await User.find({ role: 'teller', status: 'approved' }).limit(10);
    console.log('\n📋 Sample tellers:');
    tellers.forEach(t => {
      console.log(`- ${t.username}: ${t.name} (${t.status})`);
    });

    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTellers();