// simple-user-check.js - Direct database connection to check users
import mongoose from 'mongoose';
import User from './models/User.js';

async function checkUsers() {
  try {
    // Connect to MongoDB using the same connection string as the server
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');
    console.log('✅ Connected to MongoDB');

    const users = await User.find({}, 'username name role status password plainTextPassword');
    
    console.log(`\n📋 Found ${users.length} users in database:`);
    console.log('=' .repeat(70));
    
    for (const user of users) {
      console.log(`\n👤 Username: ${user.username}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Has Password: ${user.password ? 'Yes' : 'No'}`);
      console.log(`   Plain Text Password: ${user.plainTextPassword || 'Not stored'}`);
      
      // Test password comparison with common passwords
      const testPasswords = ['admin', 'admin123', '12345', 'password', user.username];
      
      for (const testPassword of testPasswords) {
        try {
          if (user.comparePassword) {
            const isMatch = await user.comparePassword(testPassword);
            if (isMatch) {
              console.log(`   ✅ PASSWORD FOUND: "${testPassword}"`);
              break;
            }
          }
        } catch (error) {
          // Try direct comparison if method fails
          if (user.password === testPassword || user.plainTextPassword === testPassword) {
            console.log(`   ✅ PASSWORD FOUND (direct): "${testPassword}"`);
            break;
          }
        }
      }
    }
    
    console.log('\n' + '=' .repeat(70));
    console.log('💡 Login Instructions:');
    console.log('   For mobile devices, use: http://192.168.0.167:5173/');
    console.log('   Try the credentials shown above with ✅ PASSWORD FOUND');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    
    // If MongoDB connection fails, let's try to read server logs for successful logins
    console.log('\n📋 Since database is not accessible, let\'s check recent login patterns...');
    console.log('Check the server logs for successful logins that show the working credentials.');
  }
}

checkUsers();