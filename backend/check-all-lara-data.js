import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TellerReport from './models/TellerReport.js';
import Capital from './models/Capital.js';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function checkAllLaraData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const lara = await User.findOne({ username: /lara/i }).lean();
    console.log(`👤 ${lara.username} (Base Salary: ₱${lara.baseSalary})\n`);

    // All reports
    const reports = await TellerReport.find({
      tellerId: lara._id,
      createdAt: { $gte: new Date('2025-11-01'), $lt: new Date('2025-11-30') }
    }).sort({ createdAt: 1 }).lean();

    console.log(`📋 Teller Reports (November): ${reports.length}\n`);
    reports.forEach(r => {
      const date = new Date(r.createdAt).toISOString().split('T')[0];
      console.log(`   ${date}: Over=₱${r.over} Short=₱${r.short}`);
    });

    // All capitals
    const capitals = await Capital.find({
      tellerId: lara._id,
      createdAt: { $gte: new Date('2025-11-01'), $lt: new Date('2025-11-30') }
    }).sort({ createdAt: 1 }).lean();

    console.log(`\n💰 Capital Records: ${capitals.length}\n`);
    capitals.forEach(c => {
      const date = new Date(c.createdAt).toISOString().split('T')[0];
      console.log(`   ${date}: ₱${c.amount}`);
    });

    // All payrolls
    const payrolls = await Payroll.find({
      user: lara._id,
      createdAt: { $gte: new Date('2025-11-01'), $lt: new Date('2025-11-30') }
    }).sort({ createdAt: 1 }).lean();

    console.log(`\n💵 Payrolls: ${payrolls.length}\n`);
    payrolls.forEach(p => {
      const date = new Date(p.createdAt).toISOString().split('T')[0];
      console.log(`   ${date}: Base=₱${p.baseSalary} Over=₱${p.over} Short=₱${p.short} Total=₱${p.totalSalary}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAllLaraData();
