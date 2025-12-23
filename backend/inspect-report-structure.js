import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function inspectReportStructure() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get raw teller report
    const report = await mongoose.connection.collection('tellerReports').findOne({});
    
    console.log('📋 Raw Teller Report Structure:');
    console.log(JSON.stringify(report, null, 2));

    // Check all fields
    if (report) {
      console.log('\n🔍 Field Analysis:');
      console.log(`  has "user" field: ${report.user ? '✅' : '❌'}`);
      console.log(`  has "tellerId" field: ${report.tellerId ? '✅' : '❌'}`);
      console.log(`  has "date" field: ${report.date ? '✅' : '❌'}`);
      console.log(`  has "createdAt" field: ${report.createdAt ? '✅' : '❌'}`);
      
      if (report.user) {
        console.log(`\n  user field value: ${report.user}`);
        console.log(`  user field type: ${typeof report.user}`);
      }
      if (report.tellerId) {
        console.log(`\n  tellerId field value: ${report.tellerId}`);
        console.log(`  tellerId field type: ${typeof report.tellerId}`);
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

inspectReportStructure();
