import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function fixLaraNov15Payroll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const lara = await User.findOne({ username: /lara/i }).lean();

    // Update Nov 15 payroll to correct values
    const result = await Payroll.updateOne(
      {
        user: lara._id,
        createdAt: {
          $gte: new Date('2025-11-15T00:00:00Z'),
          $lt: new Date('2025-11-16T00:00:00Z')
        }
      },
      {
        baseSalary: 450,
        over: 468,
        short: 0,
        totalSalary: 450 + 468 // = 918
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} payroll(s)\n`);

    // Verify
    const payroll = await Payroll.findOne({
      user: lara._id,
      createdAt: {
        $gte: new Date('2025-11-15T00:00:00Z'),
        $lt: new Date('2025-11-16T00:00:00Z')
      }
    }).lean();

    console.log('📊 Nov 15 Payroll:');
    console.log(`   Base: ₱${payroll.baseSalary}`);
    console.log(`   Over: ₱${payroll.over}`);
    console.log(`   Short: ₱${payroll.short}`);
    console.log(`   Total: ₱${payroll.totalSalary}`);

    await mongoose.disconnect();
    console.log('\n✅ Done - Nov 15 corrected to Base=₱450 + Over=₱468 = Total=₱918');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixLaraNov15Payroll();
