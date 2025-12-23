import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function fixLaraNov16() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const lara = await User.findOne({ username: /lara/i }).lean();
    
    const result = await Payroll.updateOne(
      {
        user: lara._id,
        createdAt: {
          $gte: new Date('2025-11-16T00:00:00.000Z'),
          $lt: new Date('2025-11-17T00:00:00.000Z')
        }
      },
      {
        over: 821,
        totalSalary: 450 + 821
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} payroll(s)\n`);

    const check = await Payroll.findOne({
      user: lara._id,
      createdAt: {
        $gte: new Date('2025-11-16T00:00:00.000Z'),
        $lt: new Date('2025-11-17T00:00:00.000Z')
      }
    }).lean();

    console.log('📊 Verified Nov 16 payroll:');
    console.log(`   Base: ₱${check.baseSalary}`);
    console.log(`   Over: ₱${check.over}`);
    console.log(`   Short: ₱${check.short}`);
    console.log(`   Total: ₱${check.totalSalary}`);

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixLaraNov16();
