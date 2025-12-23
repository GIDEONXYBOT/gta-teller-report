import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller')
  .then(async () => {
    const db = mongoose.connection.db;
    
    // Get direct access to users collection
    const usersCollection = db.collection('users');
    const userCount = await usersCollection.countDocuments();
    
    console.log(`\n📊 USERS COLLECTION:\n`);
    console.log(`Total documents: ${userCount}\n`);
    
    if (userCount > 0) {
      // Get all users
      const allUsers = await usersCollection.find().toArray();
      
      console.log('ALL USERS:');
      allUsers.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.name || user.email} - Role: ${user.role}, Status: ${user.status}, BaseSalary: ₱${user.baseSalary || 0}`);
      });
      
      // Search for the 5 names
      console.log('\n\n🔍 SEARCHING FOR SPECIFIC NAMES:\n');
      const names = ['charm', 'missy', 'jenessa', 'shane', 'apple'];
      
      for (const name of names) {
        const user = await usersCollection.findOne({ 
          name: { $regex: name, $options: 'i' } 
        });
        if (user) {
          console.log(`✅ ${name}: FOUND - ${user.name} (${user.role})`);
        } else {
          console.log(`❌ ${name}: NOT FOUND`);
        }
      }
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
