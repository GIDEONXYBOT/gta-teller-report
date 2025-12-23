import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const dbs = [
  'mongodb://localhost:27017/rmi-teller',
  'mongodb://localhost:27017/rmi-teller-report',
  'mongodb://localhost:27017/rmi_teller',
  'mongodb://localhost:27017/rmi_teller_report'
];

async function checkDatabase(uri) {
  const conn = await mongoose.createConnection(uri).asPromise();
  const db = conn.db;
  
  const usersCol = db.collection('users');
  const userCount = await usersCol.countDocuments();
  
  console.log(`\n🗄️  ${uri.split('/').pop()}: ${userCount} users`);
  
  if (userCount > 0) {
    // Check for our names
    const names = ['charm', 'missy', 'jenessa', 'shane', 'apple', 'keanna'];
    console.log('   Searching for:');
    for (const name of names) {
      const user = await usersCol.findOne({ name: { $regex: name, $options: 'i' } });
      if (user) {
        console.log(`   ✅ ${name}: FOUND (${user.role})`);
      }
    }
  }
  
  await conn.close();
}

(async () => {
  console.log('📊 CHECKING ALL DATABASES:\n');
  
  for (const db of dbs) {
    try {
      await checkDatabase(db);
    } catch (err) {
      console.log(`\n🗄️  ${db.split('/').pop()}: ❌ Error - ${err.message}`);
    }
  }
  
  process.exit(0);
})();
