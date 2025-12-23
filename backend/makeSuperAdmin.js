// makeSuperAdmin.js
// Change existing admin user to super_admin role
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Find user with username "admin"
    const adminUser = await User.findOne({ username: 'admin' });

    if (!adminUser) {
      console.log('❌ User with username "admin" not found.');
      console.log('Available users:');
      const users = await User.find({}).select('username name role').lean();
      users.forEach(u => {
        console.log(`  - ${u.username} (${u.name || 'N/A'}) - ${u.role}`);
      });
      await mongoose.disconnect();
      process.exit(1);
      return;
    }

    console.log('Found user:');
    console.log(`  Username: ${adminUser.username}`);
    console.log(`  Name: ${adminUser.name || 'N/A'}`);
    console.log(`  Current Role: ${adminUser.role}`);
    console.log('');

    // Update role to super_admin
    adminUser.role = 'super_admin';
    await adminUser.save();

    console.log('✅ Successfully updated role to super_admin!');
    console.log('');
    console.log('You can now login with:');
    console.log(`  Username: ${adminUser.username}`);
    console.log(`  Role: super_admin`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
