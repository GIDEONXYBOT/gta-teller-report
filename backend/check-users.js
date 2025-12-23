import mongoose from 'mongoose';
import User from './models/User.js';

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

async function checkUsers() {
  await connectDB();
  
  try {
    const users = await User.find({}, 'username name role status password plainTextPassword');
    
    console.log('\n📋 Current Users in System:');
    console.log('========================================');
    
    for (const user of users) {
      console.log(`\n👤 Username: ${user.username}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Has Password: ${user.password ? 'Yes' : 'No'}`);
      console.log(`   Plain Text Password: ${user.plainTextPassword || 'Not stored'}`);
      
      // Test password comparison
      if (user.plainTextPassword) {
        try {
          const isMatch = await user.comparePassword(user.plainTextPassword);
          console.log(`   Password Test: ${isMatch ? '✅ PASS' : '❌ FAIL'}`);
        } catch (error) {
          console.log(`   Password Test: ❌ ERROR - ${error.message}`);
        }
      }
    }
    
    console.log('\n========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking users:', error);
    process.exit(1);
  }
}

checkUsers();