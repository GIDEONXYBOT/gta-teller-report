// fixIncorrectBaseSalaries.js
// Fix payrolls where baseSalary doesn't match (User.baseSalary × daysPresent)
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

    // Get all payrolls with user info
    const allPayrolls = await Payroll.find({})
      .populate('user', 'name username role baseSalary')
      .lean();

    console.log(`Found ${allPayrolls.length} total payrolls\n`);

    let fixed = 0;
    let correct = 0;
    let skipped = 0;

    for (const payroll of allPayrolls) {
      if (!payroll.user || !payroll.user._id) {
        console.log(`⚠️  Skipping payroll ${payroll._id} - no user reference`);
        skipped++;
        continue;
      }

      const user = payroll.user;
      const dailyBase = Number(user.baseSalary || 0);
      const daysPresent = Number(payroll.daysPresent || 1);
      const correctBase = dailyBase * daysPresent;
      const currentBase = Number(payroll.baseSalary || 0);

      if (currentBase === correctBase) {
        correct++;
        continue;
      }

      console.log(`\n🔧 ${user.name || user.username}`);
      console.log(`   Payroll ID: ${payroll._id}`);
      console.log(`   User daily base: ₱${dailyBase}`);
      console.log(`   Days present: ${daysPresent}`);
      console.log(`   Current base: ₱${currentBase} ❌`);
      console.log(`   Correct base: ₱${correctBase} ✅`);

      // Recalculate total
      const newTotal = correctBase + 
                      (Number(payroll.over) || 0) - 
                      (Number(payroll.short) || 0) - 
                      (Number(payroll.deduction) || 0) - 
                      (Number(payroll.withdrawal) || 0);

      console.log(`   Old total: ₱${payroll.totalSalary || 0}`);
      console.log(`   New total: ₱${newTotal}`);

      // Update payroll
      await Payroll.findByIdAndUpdate(payroll._id, {
        $set: {
          baseSalary: correctBase,
          totalSalary: newTotal
        }
      });

      console.log(`   ✅ Updated!`);
      fixed++;
    }

    console.log(`\n\n=== SUMMARY ===`);
    console.log(`Total payrolls: ${allPayrolls.length}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Already correct: ${correct}`);
    console.log(`Skipped (no user): ${skipped}`);
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
