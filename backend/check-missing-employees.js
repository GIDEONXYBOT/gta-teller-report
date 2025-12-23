import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import User from './models/User.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rmi-teller')
  .then(async () => {
    const names = ['charm', 'missy', 'jenessa', 'shane', 'apple'];
    
    console.log('\n🔍 CHECKING USER MODEL:\n');
    for (const name of names) {
      const user = await User.findOne({ 
        name: { $regex: name, $options: 'i' } 
      });
      if (user) {
        console.log(`✅ ${name}: FOUND`);
        console.log(`   - ID: ${user._id}`);
        console.log(`   - Role: ${user.role}`);
        console.log(`   - Status: ${user.status}`);
        console.log(`   - BaseSalary: ₱${user.baseSalary}\n`);
      } else {
        console.log(`❌ ${name}: NOT FOUND in User model\n`);
      }
    }
    
    // Check database collections
    console.log('🔍 CHECKING DATABASE COLLECTIONS:\n');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('Available collections:', collectionNames.join(', '));
    
    // Check for approvals or pending collections
    console.log('\n📋 COLLECTIONS THAT MIGHT CONTAIN PENDING/APPROVAL DATA:\n');
    const relevantColls = collectionNames.filter(c => 
      c.includes('approval') || c.includes('pending') || c.includes('invite') || c.includes('request')
    );
    
    if (relevantColls.length > 0) {
      for (const collName of relevantColls) {
        const collection = db.collection(collName);
        const count = await collection.countDocuments();
        console.log(`📌 ${collName}: ${count} records`);
        
        // Show sample
        const sample = await collection.findOne();
        if (sample) {
          console.log(`   Sample: ${JSON.stringify(sample).substring(0, 100)}...\n`);
          
          // Check for our names
          for (const name of names) {
            const record = await collection.findOne({ 
              $or: [
                { name: { $regex: name, $options: 'i' } },
                { email: { $regex: name, $options: 'i' } }
              ]
            });
            if (record) {
              console.log(`   ✅ ${name}: FOUND - ${JSON.stringify(record).substring(0, 80)}`);
            }
          }
        }
      }
    }
    
    // Show all users
    console.log('\n📊 ALL USERS IN SYSTEM BY ROLE:\n');
    const allUsers = await User.find().select('name role status').lean();
    const roleGroups = {};
    
    allUsers.forEach(user => {
      if (!roleGroups[user.role]) roleGroups[user.role] = [];
      roleGroups[user.role].push(user.name);
    });
    
    for (const [role, users] of Object.entries(roleGroups)) {
      console.log(`${role.toUpperCase()}: ${users.sort().join(', ')}`);
    }
    
    console.log(`\nTotal users: ${allUsers.length}`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
