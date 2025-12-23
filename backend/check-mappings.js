import mongoose from 'mongoose';
import TellerMapping from './models/TellerMapping.js';

async function checkMappings() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');
    console.log('✅ Connected to database');

    const count = await TellerMapping.countDocuments();
    console.log(`📊 Total teller mappings: ${count}`);

    const allMappings = await TellerMapping.find({});
    console.log(`\n📋 All mappings (${allMappings.length}):`);
    allMappings.forEach(m => {
      console.log(`- ${m.tellerId}: ${m.bettingUsername} (${m.matchConfidence}, active: ${m.isActive})`);
    });

    const activeMappings = await TellerMapping.find({ isActive: true });
    console.log(`\n📋 Active mappings (${activeMappings.length}):`);
    activeMappings.forEach(m => {
      console.log(`- ${m.tellerId}: ${m.bettingUsername} (${m.matchConfidence})`);
    });

    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMappings();