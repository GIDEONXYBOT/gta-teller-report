import mongoose from 'mongoose';
import User from './models/User.js';
import TellerReport from './models/TellerReport.js';

await mongoose.connect('mongodb://localhost:27017/rmi-teller-report').then(async () => {
  try {
    console.log('\n📊 DATABASE COLLECTIONS:');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`  - ${col.name}: ${count} documents`);
    }
    
    console.log('\n👥 USERS:');
    const users = await User.find({}).select('name username role').lean();
    console.log(`  Total users: ${users.length}`);
    if (users.length > 0) {
      users.forEach(u => {
        console.log(`    - ${u.name || u.username} (${u.role})`);
      });
    }
    
    console.log('\n📋 TELLER REPORTS:');
    const reports = await TellerReport.find({}).limit(10).lean();
    console.log(`  Total reports: ${await TellerReport.countDocuments()}`);
    if (reports.length > 0) {
      reports.slice(0, 5).forEach(r => {
        console.log(`    - Date: ${r.date}, Cash on hand: ₱${r.cashOnHand}`);
      });
    }
    
    console.log('\n✅ Query complete\n');
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await mongoose.connection.close();
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
