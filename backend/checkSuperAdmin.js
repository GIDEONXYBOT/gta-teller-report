// checkSuperAdmin.js
// Check if super_admin account exists in the database
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

    // Find all super_admin users
    const superAdmins = await User.find({ role: 'super_admin' }).lean();

    if (superAdmins.length === 0) {
      console.log('❌ No super_admin account found.\n');
      console.log('Would you like to create one? You can create a super_admin account by running:');
      console.log('node createSuperAdmin.js\n');
    } else {
      console.log(`✅ Found ${superAdmins.length} super_admin account(s):\n`);
      superAdmins.forEach((admin, idx) => {
        console.log(`${idx + 1}. Username: ${admin.username}`);
        console.log(`   Name: ${admin.name || 'N/A'}`);
        console.log(`   Email: ${admin.email || 'N/A'}`);
        console.log(`   Status: ${admin.status}`);
        console.log(`   Created: ${admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'N/A'}`);
        console.log('');
      });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
