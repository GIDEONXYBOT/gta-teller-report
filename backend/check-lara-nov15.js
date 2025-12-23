import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TellerReport from './models/TellerReport.js';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function checkLaraNov15() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const lara = await User.findOne({ username: /lara/i }).lean();
    console.log(`👤 ${lara.username}\n`);

    // Check Nov 15 teller reports
    const reports = await TellerReport.find({
      tellerId: lara._id,
      createdAt: {
        $gte: new Date('2025-11-15T00:00:00Z'),
        $lt: new Date('2025-11-16T00:00:00Z')
      }
    }).lean();

    console.log(`📋 Teller Reports on Nov 15: ${reports.length}`);
    reports.forEach(r => {
      const time = new Date(r.createdAt).toISOString();
      console.log(`   ${time}`);
      console.log(`   Over: ₱${r.over}`);
      console.log(`   Short: ₱${r.short}\n`);
    });

    // Check Nov 15 payroll
    const payroll = await Payroll.findOne({
      user: lara._id,
      createdAt: {
        $gte: new Date('2025-11-15T00:00:00Z'),
        $lt: new Date('2025-11-16T00:00:00Z')
      }
    }).lean();

    console.log(`💰 Payroll on Nov 15: ${payroll ? 'Found' : 'Not found'}`);
    if (payroll) {
      console.log(`   Base: ₱${payroll.baseSalary}`);
      console.log(`   Over: ₱${payroll.over}`);
      console.log(`   Short: ₱${payroll.short}`);
      console.log(`   Total: ₱${payroll.totalSalary}`);
      
      if (payroll.over !== 468 || payroll.baseSalary !== 450) {
        console.log('\n⚠️  MISMATCH DETECTED!');
        console.log(`   Expected: Base=₱450, Over=₱468`);
        console.log(`   Actual: Base=₱${payroll.baseSalary}, Over=₱${payroll.over}`);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkLaraNov15();
