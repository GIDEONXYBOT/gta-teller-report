import mongoose from 'mongoose';

await mongoose.connect('mongodb://localhost:27017/rmi-teller-report').then(async () => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📊 ALL COLLECTIONS IN DATABASE:');
    
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`  - ${col.name}: ${count} documents`);
      
      if (count > 0 && count < 20) {
        const samples = await mongoose.connection.db.collection(col.name).find({}).limit(3).toArray();
        console.log(`    Sample records:`);
        samples.forEach(doc => {
          console.log(`      - ${JSON.stringify(doc).substring(0, 100)}...`);
        });
      }
    }
    
    console.log('\n✅ Done\n');
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await mongoose.connection.close();
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
