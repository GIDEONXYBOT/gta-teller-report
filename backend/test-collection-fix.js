import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TellerReport from './models/TellerReport.js';

dotenv.config();

async function testFix() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find teller reports using the fixed model
    const reports = await TellerReport.find().lean();
    console.log(`📋 TellerReport.find() returned: ${reports.length} report(s)`);
    
    if (reports.length > 0) {
      const r = reports[0];
      console.log('\n✅ Sample Report:');
      console.log(`   ID: ${r._id}`);
      console.log(`   tellerId: ${r.tellerId}`);
      console.log(`   Over: ₱${r.over}`);
      console.log(`   Short: ₱${r.short}`);
      console.log(`   Date: ${r.date}`);
    } else {
      console.log('❌ No reports found - model fix may not have worked');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

testFix();
