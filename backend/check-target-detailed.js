#!/usr/bin/env node

// Quick check without requiring .env since we'll use direct mongo string
import mongoose from 'mongoose';

const mongoUri = 'mongodb+srv://gideonbot:gideonbot2024@rmi-teller-db.ey8n7.mongodb.net/rmi_teller_report?retryWrites=true&w=majority';

(async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas\n');

    // Check payroll records with zero base salary
    const db = mongoose.connection.db;
    const payrollCol = db.collection('payrolls');
    const userCol = db.collection('users');

    // Find payroll records with 0 or null base salary
    const zeroPayrolls = await payrollCol
      .find({ baseSalary: { $in: [0, null] } })
      .limit(30)
      .toArray();

    if (zeroPayrolls.length > 0) {
      console.log(`📋 Found ${zeroPayrolls.length} payroll records with ₱0 base salary:\n`);
      for (const p of zeroPayrolls) {
        console.log(`   - ${p.tellerName || p.name || 'Unknown'} (${p.date}): ₱${p.baseSalary || 0}`);
      }
    } else {
      console.log('✅ All payroll records have proper base salaries!\n');
    }

    // Find users with 0 base salary (excluding admins)
    const zeroUsers = await userCol
      .find({ 
        $and: [
          { baseSalary: { $in: [0, null] } },
          { role: { $nin: ['admin', 'super_admin'] } }
        ]
      })
      .limit(30)
      .toArray();

    if (zeroUsers.length > 0) {
      console.log(`\n👥 Found ${zeroUsers.length} users with ₱0 base salary:\n`);
      for (const u of zeroUsers) {
        console.log(`   - ${u.name || u.username} (${u.role}): ₱${u.baseSalary || 0}`);
      }
    } else {
      console.log('\n✅ All users have proper base salaries!\n');
    }

    // Check the 5 specific employees
    console.log('\n🔍 Checking for the 5 target employees:');
    const names = ['charm', 'missy', 'jenessa', 'shane', 'apple'];
    for (const name of names) {
      const user = await userCol.findOne({ 
        name: { $regex: name, $options: 'i' } 
      });
      const payrolls = await payrollCol
        .find({ tellerName: { $regex: name, $options: 'i' } })
        .limit(3)
        .toArray();
      
      console.log(`\n${name.toUpperCase()}:`);
      if (user) {
        console.log(`  ✅ User FOUND: ${user.name} (${user.role}) - Base: ₱${user.baseSalary || 0}`);
      } else {
        console.log(`  ❌ User NOT FOUND in users collection`);
      }
      
      if (payrolls.length > 0) {
        console.log(`  ✅ Payroll records found (${payrolls.length}):`);
        for (const p of payrolls) {
          console.log(`     - ${p.date}: Base ₱${p.baseSalary || 0}`);
        }
      } else {
        console.log(`  ❌ No payroll records found`);
      }
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
