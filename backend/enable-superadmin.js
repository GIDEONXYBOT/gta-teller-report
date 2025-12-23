#!/usr/bin/env node

/**
 * Enable SuperAdmin for a specific user
 * Usage: node enable-superadmin.js --username "admin"
 */

import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const getArgs = () => {
  const args = process.argv.slice(2);
  const result = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      result[key] = args[i + 1];
      i++;
    }
  }
  
  return result;
};

const main = async () => {
  const args = getArgs();
  const username = args.username || 'admin';
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi-teller-report';
    console.log(`🔄 Connecting to MongoDB: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
    
    // Find user
    const user = await User.findOne({ username });
    
    if (!user) {
      console.error(`❌ User "${username}" not found`);
      process.exit(1);
    }
    
    console.log(`📋 User Found: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   SuperAdmin: ${user.isSuperAdmin || false}`);
    console.log('');
    
    // Enable SuperAdmin
    user.isSuperAdmin = true;
    await user.save();
    
    console.log('✅ SuperAdmin enabled successfully!\n');
    console.log(`📋 Updated User:`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   SuperAdmin: ${user.isSuperAdmin}`);
    console.log('\n✨ You can now access the Financial Summary Report!');
    console.log('   URL: https://www.rmi.gideonbot.xyz/admin/financial-summary');
    console.log('\n💡 Remember to log out and log back in to refresh your session.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

main();
