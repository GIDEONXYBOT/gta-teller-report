import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import TellerReport from './models/TellerReport.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkAllMarebelenReports() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find Marebelen
    const marebelen = await User.findOne({ username: /marebelen/i });
    console.log(`👤 Marebelen: ${marebelen.name} (${marebelen._id})\n`);

    // Get ALL teller reports for Marebelen
    const allReports = await TellerReport.find({ user: marebelen._id })
      .sort({ createdAt: 1 })
      .lean();

    console.log(`📝 Total teller reports: ${allReports.length}\n`);

    if (allReports.length === 0) {
      console.log('❌ No teller reports found');
      await mongoose.disconnect();
      return;
    }

    console.log('📅 All Teller Reports:\n');
    allReports.forEach((r, i) => {
      const date = new Date(r.createdAt);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      console.log(`${i + 1}. ${dateStr}`);
      console.log(`   ID: ${r._id}`);
      console.log(`   Over: ₱${r.over || 0}, Short: ₱${r.short || 0}`);
      console.log(`   Created: ${r.createdAt}`);
      console.log('');
    });

    // Get all payrolls
    const allPayrolls = await Payroll.find({ user: marebelen._id })
      .sort({ createdAt: 1 })
      .lean();

    console.log('💰 All Payrolls:\n');
    allPayrolls.forEach((p, i) => {
      const date = new Date(p.createdAt);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      console.log(`${i + 1}. ${dateStr}`);
      console.log(`   ID: ${p._id}`);
      console.log(`   Base: ₱${p.baseSalary}, Over: ₱${p.over}, Short: ₱${p.short}, Total: ₱${p.totalSalary}`);
      console.log(`   Created: ${p.createdAt}`);
      console.log('');
    });

    // Check for Nov 9 payroll that should be deleted (no matching report)
    const nov9Payroll = allPayrolls.find(p => {
      const date = new Date(p.createdAt);
      return date.getMonth() === 10 && date.getDate() === 9;
    });

    if (nov9Payroll && allReports.length === 2) {
      console.log('⚠️  Issue detected:');
      console.log('   - Marebelen has a Nov 9 payroll with ₱4334 over');
      console.log('   - But only has 2 teller reports (Nov 15 and Nov 16)');
      console.log('   - The Nov 9 payroll should be DELETED (orphaned payroll with incorrect data)');
      console.log(`   - Payroll ID to delete: ${nov9Payroll._id}`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkAllMarebelenReports();
