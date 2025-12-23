import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import User from './models/User.js';

dotenv.config();

async function checkFebbyPayroll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find Febby
    const febby = await User.findOne({
      $or: [
        { username: /febby/i },
        { name: /febby/i },
        { username: /trexie/i },
        { name: /trexie/i }
      ]
    }).lean();

    if (!febby) {
      console.log('❌ Febby/Trexie not found');
      await mongoose.disconnect();
      return;
    }

    console.log(`👤 Found: ${febby.username || febby.name} (${febby._id})`);
    console.log(`   Role: ${febby.role}, Base Salary: ₱${febby.baseSalary || 0}\n`);
    console.log('='.repeat(80));

    // Get all payrolls for Nov 10-17
    const startDate = new Date('2025-11-10T00:00:00Z');
    const endDate = new Date('2025-11-18T00:00:00Z');

    const payrolls = await Payroll.find({
      user: febby._id,
      createdAt: { $gte: startDate, $lt: endDate }
    }).sort({ createdAt: 1 }).lean();

    console.log(`\n💰 PAYROLLS (Nov 10-17): ${payrolls.length} total\n`);

    // Group by date
    const payrollsByDate = {};
    payrolls.forEach(p => {
      const date = new Date(p.createdAt).toISOString().split('T')[0];
      if (!payrollsByDate[date]) {
        payrollsByDate[date] = [];
      }
      payrollsByDate[date].push(p);
    });

    // Check for duplicates
    let hasDuplicates = false;
    for (const [date, datePayrolls] of Object.entries(payrollsByDate)) {
      const isDuplicate = datePayrolls.length > 1;
      if (isDuplicate) hasDuplicates = true;

      console.log(`📅 ${date}: ${datePayrolls.length} payroll${datePayrolls.length > 1 ? 's' : ''} ${isDuplicate ? '⚠️  DUPLICATE!' : '✅'}`);
      
      datePayrolls.forEach((p, idx) => {
        console.log(`   ${idx + 1}. ID: ${p._id}`);
        console.log(`      Base: ₱${p.baseSalary}, Over: ₱${p.over}, Short: ₱${p.short}, Total: ₱${p.totalSalary}`);
        console.log(`      Created: ${new Date(p.createdAt).toISOString()}`);
        console.log(`      Role: ${p.role}, Approved: ${p.approved || false}`);
      });
      console.log();
    }

    // Get teller reports
    console.log('='.repeat(80));
    const reports = await TellerReport.find({
      tellerId: febby._id,
      createdAt: { $gte: startDate, $lt: endDate }
    }).sort({ createdAt: 1 }).lean();

    console.log(`\n📊 TELLER REPORTS: ${reports.length} total\n`);
    reports.forEach((r, idx) => {
      const date = new Date(r.createdAt).toISOString().split('T')[0];
      console.log(`${idx + 1}. ${date}: Over=₱${r.over}, Short=₱${r.short}`);
      console.log(`   Report ID: ${r._id}`);
      console.log(`   Created: ${new Date(r.createdAt).toISOString()}`);
    });

    console.log('\n' + '='.repeat(80));
    
    if (hasDuplicates) {
      console.log('\n⚠️  DUPLICATE PAYROLLS FOUND!\n');
      console.log('Recommendation:');
      console.log('1. Keep the payroll with correct data (matching teller report)');
      console.log('2. Delete the duplicate payroll\n');
      
      console.log('To delete a payroll, use:');
      console.log('   node delete-payroll.js <payroll_id>');
    } else {
      console.log('\n✅ No duplicate payrolls found - all good!');
    }

    await mongoose.disconnect();
    console.log('\n✅ Check complete');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkFebbyPayroll();
