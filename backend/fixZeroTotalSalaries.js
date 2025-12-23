// fixZeroTotalSalaries.js
// Fix payrolls with totalSalary = 0 by setting correct base salary
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payroll from './models/Payroll.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  try {
    console.log('Connecting to', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Get all payrolls with totalSalary = 0
    const zeroPayrolls = await Payroll.find({ 
      $or: [
        { totalSalary: 0 },
        { totalSalary: { $exists: false } }
      ]
    }).populate('user', 'name username role baseSalary').lean();

    console.log(`Found ${zeroPayrolls.length} payrolls with zero/missing totalSalary\n`);

    let fixed = 0;
    let skipped = 0;

    for (const payroll of zeroPayrolls) {
      if (!payroll.user || !payroll.user._id) {
        console.log(`⚠️  Skipping payroll ${payroll._id} - no user reference`);
        skipped++;
        continue;
      }

      const user = payroll.user;
      const dailyBase = Number(user.baseSalary || 0);
      
      if (dailyBase === 0) {
        console.log(`⚠️  Skipping ${user.name || user.username} - User.baseSalary is 0`);
        skipped++;
        continue;
      }

      const daysPresent = Number(payroll.daysPresent || 1);
      const correctBase = dailyBase * daysPresent;
      
      // Calculate total
      const newTotal = correctBase + 
                      (Number(payroll.over) || 0) - 
                      (Number(payroll.short) || 0) - 
                      (Number(payroll.deduction) || 0) - 
                      (Number(payroll.withdrawal) || 0);

      console.log(`\n🔧 ${user.name || user.username} (${user.role})`);
      console.log(`   Payroll ID: ${payroll._id}`);
      console.log(`   User daily base: ₱${dailyBase}`);
      console.log(`   Days present: ${daysPresent}`);
      console.log(`   Current base: ₱${payroll.baseSalary || 0}`);
      console.log(`   Setting base: ₱${correctBase}`);
      console.log(`   Over: ₱${payroll.over || 0}, Short: ₱${payroll.short || 0}`);
      console.log(`   Deduction: ₱${payroll.deduction || 0}`);
      console.log(`   Old total: ₱${payroll.totalSalary || 0}`);
      console.log(`   New total: ₱${newTotal}`);

      // Update payroll
      await Payroll.findByIdAndUpdate(payroll._id, {
        $set: {
          baseSalary: correctBase,
          totalSalary: newTotal,
          daysPresent: daysPresent
        }
      });

      console.log(`   ✅ Updated!`);
      fixed++;
    }

    console.log(`\n\n=== SUMMARY ===`);
    console.log(`Total zero payrolls: ${zeroPayrolls.length}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`\n✅ Fix complete!`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
