import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function checkNov10Payrolls() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const nov10Start = new Date('2025-11-10T00:00:00Z');
    const nov10End = new Date('2025-11-11T00:00:00Z');

    console.log(`📅 Checking all payrolls for: November 10, 2025\n`);
    console.log('='.repeat(80));

    const payrolls = await Payroll.find({
      createdAt: { $gte: nov10Start, $lt: nov10End }
    }).populate('user', 'username name role').sort({ user: 1, createdAt: 1 }).lean();

    console.log(`\n💰 Total payrolls on Nov 10: ${payrolls.length}\n`);

    // Group by user
    const payrollsByUser = {};
    payrolls.forEach(p => {
      const userId = p.user._id.toString();
      if (!payrollsByUser[userId]) {
        payrollsByUser[userId] = {
          user: p.user,
          payrolls: []
        };
      }
      payrollsByUser[userId].payrolls.push(p);
    });

    // Show all users
    let duplicateCount = 0;
    for (const [userId, data] of Object.entries(payrollsByUser)) {
      const userName = data.user.username || data.user.name || 'Unknown';
      const role = data.user.role || 'unknown';
      const isDuplicate = data.payrolls.length > 1;
      
      if (isDuplicate) duplicateCount++;

      console.log(`👤 ${userName} (${role}): ${data.payrolls.length} payroll${data.payrolls.length > 1 ? 's' : ''} ${isDuplicate ? '⚠️  DUPLICATE!' : '✅'}`);
      
      data.payrolls.forEach((p, idx) => {
        console.log(`   ${idx + 1}. ID: ${p._id}`);
        console.log(`      Base: ₱${p.baseSalary}, Over: ₱${p.over}, Short: ₱${p.short}, Total: ₱${p.totalSalary}`);
        console.log(`      Created: ${new Date(p.createdAt).toISOString()}`);
        console.log(`      Approved: ${p.approved || false}, Locked: ${p.locked || false}`);
      });
      console.log();
    }

    console.log('='.repeat(80));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total users with payrolls: ${Object.keys(payrollsByUser).length}`);
    console.log(`   Users with duplicates: ${duplicateCount}`);
    console.log(`   Total payroll records: ${payrolls.length}`);

    if (duplicateCount > 0) {
      console.log('\n⚠️  DUPLICATES DETECTED!\n');
      console.log('These users have multiple payrolls on the same day.');
      console.log('This should not happen with the fixed logic.');
      console.log('\nWould you like me to create a script to merge/delete duplicates?');
    } else {
      console.log('\n✅ No duplicates - all users have exactly 1 payroll for Nov 10');
    }

    await mongoose.disconnect();
    console.log('\n✅ Check complete');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkNov10Payrolls();
