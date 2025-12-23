import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TellerReport from './models/TellerReport.js';
import Capital from './models/Capital.js';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function checkOriginalData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check teller reports from Nov 10-16
    const reports = await TellerReport.find({
      createdAt: { $gte: new Date('2025-11-10'), $lt: new Date('2025-11-17') }
    }).populate('tellerId', 'username').lean().sort({ createdAt: 1 });

    console.log('📊 Teller Reports (Nov 10-16):\n');
    reports.forEach(r => {
      const date = new Date(r.createdAt).toISOString().split('T')[0];
      console.log(`${date} - ${r.tellerId?.username || 'Unknown'}: Over=₱${r.over} Short=₱${r.short}`);
    });

    // Check capital records
    const capitals = await Capital.find({
      createdAt: { $gte: new Date('2025-11-10'), $lt: new Date('2025-11-17') }
    }).populate('tellerId supervisorId', 'username').lean().sort({ createdAt: 1 });

    console.log('\n\n💰 Capital Records (Nov 10-16):\n');
    capitals.forEach(c => {
      const date = new Date(c.createdAt).toISOString().split('T')[0];
      console.log(`${date} - ${c.supervisorId?.username || 'Unknown'} → ${c.tellerId?.username || 'Unknown'}: ₱${c.amount}`);
    });

    // Check current payrolls
    const payrolls = await Payroll.find({
      createdAt: { $gte: new Date('2025-11-10'), $lt: new Date('2025-11-17') }
    }).populate('user', 'username role').lean().sort({ createdAt: 1 });

    console.log('\n\n💵 Current Payrolls (Nov 10-16):\n');
    payrolls.forEach(p => {
      const date = new Date(p.createdAt).toISOString().split('T')[0];
      console.log(`${date} - ${p.user?.username || 'Unknown'} (${p.user?.role}): Base=₱${p.baseSalary} Over=₱${p.over} Short=₱${p.short} Total=₱${p.totalSalary}`);
    });

    console.log(`\n\n📈 Summary:`);
    console.log(`   Reports: ${reports.length}`);
    console.log(`   Capitals: ${capitals.length}`);
    console.log(`   Payrolls: ${payrolls.length}`);

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkOriginalData();
