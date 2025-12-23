// Check database users and test login credentials
import mongoose from 'mongoose';

// Connect to MongoDB directly using the server's connection
async function main() {
  try {
    // Use the same connection string as the server
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to database');
    
    // Import User model
    const User = mongoose.model('User', new mongoose.Schema({
      username: String,
      name: String,
      password: String,
      plainTextPassword: String,
      role: String,
      status: String
    }, { collection: 'users' }));
    
    const users = await User.find({});
    console.log(`\n📋 Found ${users.length} users:`);
    console.log('=====================================');
    
    for (const user of users) {
      console.log(`\n👤 ${user.username} (${user.name})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Password: ${user.password || 'No password'}`);
      console.log(`   Plain text: ${user.plainTextPassword || 'No plain text'}`);
    }
    
    console.log('\n=====================================');
    console.log('💡 Try these login combinations:');
    
    const testCreds = [
      ['admin', 'admin123'],
      ['admin', 'admin'],
      ['Daniel', '12345'],
      ['daniel', '12345'],
    ];
    
    testCreds.forEach(([username, password]) => {
      console.log(`   Username: ${username}, Password: ${password}`);
    });
    
  } catch (error) {
    console.log('❌ Could not connect to database directly');
    console.log('The database might only be accessible when the server is running');
    console.log('\n💡 Based on server logs, try these credentials:');
    console.log('   Username: Daniel, Password: 12345 (confirmed working)');
    console.log('   Username: admin, Password: admin123 (likely working)');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

main();