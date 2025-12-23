// create-declarator.js
// Quick script to create a declarator account
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from './models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function createDeclarator() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Check if declarator already exists
    const existing = await User.findOne({ username: 'declarator' });
    if (existing) {
      console.log('✅ Declarator account already exists');
      console.log(`   Username: ${existing.username}`);
      console.log(`   Role: ${existing.role}`);
      console.log(`   Status: ${existing.status}`);
      await mongoose.disconnect();
      return;
    }

    // Create new declarator user
    const hashedPassword = await bcrypt.hash('declarator123', 10);
    const declarator = new User({
      username: 'declarator',
      password: hashedPassword,
      name: 'Declarator',
      email: 'declarator@rmi.com',
      role: 'declarator',
      status: 'approved',
      active: true,
    });

    await declarator.save();
    console.log('✅ Declarator account created successfully!\n');
    console.log('Login credentials:');
    console.log(`   Username: declarator`);
    console.log(`   Password: declarator123`);
    console.log(`   Role: declarator\n`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createDeclarator();
