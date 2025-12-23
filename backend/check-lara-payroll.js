import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import TellerReport from './models/TellerReport.js';

dotenv.config();

async function fixLaraPayroll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find Lara
    const lara = await User.findOne({ username: /lara/i }).lean();
    if (!lara) {
      console.log('❌ Lara not found');
      process.exit(1);
    }

    console.log(`👤 Found: ${lara.username} (${lara._id})\n`);

    // Check current payrolls
    const payrolls = await Payroll.find({ user: lara._id }).sort({ createdAt: -1 }).lean();
    console.log(`Current payrolls (${payrolls.length}):`);
    payrolls.forEach(p => {
      const date = new Date(p.createdAt).toISOString().split('T')[0];
      console.log(`   ${date}: Base=₱${p.baseSalary} Over=₱${p.over} Short=₱${p.short} Total=₱${p.totalSalary} [${p._id.toString().slice(-8)}]`);
    });

    // Check teller reports
    const reports = await TellerReport.find({ 
      tellerId: lara._id,
      createdAt: { $gte: new Date('2025-11-01'), $lt: new Date('2025-11-30') }
    }).sort({ createdAt: 1 }).lean();
    
    console.log(`\nTeller reports (${reports.length}):`);
    reports.forEach(r => {
      const date = new Date(r.createdAt).toISOString().split('T')[0];
      console.log(`   ${date}: Over=₱${r.over} Short=₱${r.short}`);
    });

    // What needs to be fixed?
    console.log('\n🔧 What do you want to fix?');
    console.log('   1. Nov 15 payroll shows ₱821 over but should be different?');
    console.log('   2. Missing payroll for a specific date?');
    console.log('   3. Duplicate payroll on same day?');
    console.log('   4. Other issue?');
    
    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixLaraPayroll();
