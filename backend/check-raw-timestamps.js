import mongoose from 'mongoose';
import Transaction from './models/Transaction.js';

await mongoose.connect('mongodb://localhost:27017/rmi_teller_report').then(async () => {
  try {
    const txns = await Transaction.find({}).lean();
    console.log('\n📋 RAW TRANSACTION TIMESTAMPS:\n');
    txns.forEach((t, i) => {
      console.log(`Transaction ${i + 1}:`);
      console.log(`  createdAt: ${t.createdAt}`);
      console.log(`  createdAt ISO: ${t.createdAt.toISOString()}`);
      console.log(`  createdAt getTime: ${t.createdAt.getTime()}`);
    });
    
    console.log('\n✅ Done\n');
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await mongoose.connection.close();
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
