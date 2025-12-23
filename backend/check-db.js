import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller')
  .then(async () => {
    const db = mongoose.connection.db;
    
    console.log('\n📊 DATABASE ANALYSIS:\n');
    console.log(`Connected to: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller'}`);
    
    // List all databases
    const admin = db.admin();
    const { databases } = await admin.listDatabases();
    console.log(`\n🗄️  Available databases:\n`);
    databases.forEach(db => {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    // List all collections in current database
    const collections = await db.listCollections().toArray();
    console.log(`\n📋 Collections in current database:\n`);
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    // Check users collection in detail
    const usersCol = db.collection('users');
    const userCount = await usersCol.countDocuments();
    console.log(`\n📌 Users Collection: ${userCount} documents`);
    
    if (userCount > 0) {
      const sample = await usersCol.findOne();
      console.log(`Sample document:\n${JSON.stringify(sample, null, 2)}`);
    } else {
      console.log('❌ Users collection is empty!');
    }
    
    // Check payrolls collection
    const payrollsCol = db.collection('payrolls');
    const payrollCount = await payrollsCol.countDocuments();
    console.log(`\n📌 Payrolls Collection: ${payrollCount} documents`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
