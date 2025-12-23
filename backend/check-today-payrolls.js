import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import Capital from './models/Capital.js';
import User from './models/User.js';

dotenv.config();

async function checkTodayPayrolls() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log(`📅 Checking payrolls for: ${today.toISOString().split('T')[0]}\n`);
    console.log('='.repeat(80));

    // Check payrolls
    const payrolls = await Payroll.find({
      createdAt: { $gte: today, $lt: tomorrow }
    }).populate('user', 'username name role').lean();

    console.log(`\n💰 PAYROLLS TODAY: ${payrolls.length}\n`);
    payrolls.forEach(p => {
      const userName = p.user?.username || p.user?.name || 'Unknown';
      const role = p.user?.role || 'unknown';
      console.log(`   ${userName} (${role}): Base=₱${p.baseSalary}, Over=₱${p.over}, Short=₱${p.short}, Total=₱${p.totalSalary}`);
    });

    // Check teller reports
    console.log('\n' + '='.repeat(80));
    const reports = await TellerReport.find({
      createdAt: { $gte: today, $lt: tomorrow }
    }).populate('tellerId', 'username name role').lean();

    console.log(`\n📊 TELLER REPORTS TODAY: ${reports.length}\n`);
    reports.forEach(r => {
      const tellerName = r.tellerId?.username || r.tellerId?.name || 'Unknown';
      console.log(`   ${tellerName}: Over=₱${r.over}, Short=₱${r.short}`);
    });

    // Check capitals
    console.log('\n' + '='.repeat(80));
    const capitals = await Capital.find({
      createdAt: { $gte: today, $lt: tomorrow }
    }).populate('tellerId supervisorId', 'username name role').lean();

    console.log(`\n💵 CAPITAL RECORDS TODAY: ${capitals.length}\n`);
    capitals.forEach(c => {
      const tellerName = c.tellerId?.username || c.tellerId?.name || 'Unknown';
      const supervisorName = c.supervisorId?.username || c.supervisorId?.name || 'Unknown';
      console.log(`   ${supervisorName} → ${tellerName}: ₱${c.amount}`);
    });

    // Check all tellers
    console.log('\n' + '='.repeat(80));
    const tellers = await User.find({
      role: { $in: ['teller', 'supervisor_teller'] }
    }).lean();

    console.log(`\n👥 ALL TELLERS: ${tellers.length}\n`);
    
    console.log('TELLERS WITH PAYROLL TODAY:');
    const tellersWithPayroll = payrolls.filter(p => ['teller', 'supervisor_teller'].includes(p.user?.role));
    console.log(`   Count: ${tellersWithPayroll.length}`);
    tellersWithPayroll.forEach(p => {
      console.log(`   - ${p.user.username || p.user.name}`);
    });

    console.log('\nTELLERS WITHOUT PAYROLL TODAY:');
    const tellerIdsWithPayroll = new Set(tellersWithPayroll.map(p => p.user._id.toString()));
    const tellersWithoutPayroll = tellers.filter(t => !tellerIdsWithPayroll.has(t._id.toString()));
    console.log(`   Count: ${tellersWithoutPayroll.length}`);
    tellersWithoutPayroll.forEach(t => {
      const hasReport = reports.find(r => r.tellerId?._id?.toString() === t._id.toString());
      const hasCapital = capitals.find(c => c.tellerId?._id?.toString() === t._id.toString());
      console.log(`   - ${t.username || t.name} | Report: ${hasReport ? '✅' : '❌'} | Capital: ${hasCapital ? '✅' : '❌'}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 LOGIC EXPLANATION:\n');
    console.log('1. TELLER PAYROLLS are created when:');
    console.log('   ✅ Teller submits an end-of-day report (via syncPayrollFromReports)');
    console.log('   ✅ Report sync updates/creates payroll with over/short amounts\n');
    
    console.log('2. SUPERVISOR PAYROLLS are created when:');
    console.log('   ✅ Supervisor gives capital to a teller');
    console.log('   ✅ Capital route auto-creates supervisor payroll for that day\n');
    
    console.log('3. BASE SALARY is added when:');
    console.log('   ✅ For tellers: When they submit their first report');
    console.log('   ✅ For supervisors: When they distribute capital\n');

    console.log('💡 ANSWER: Tellers MUST submit a report first to get payroll created.');
    console.log('   Without a report, no payroll record exists for that day.');

    await mongoose.disconnect();
    console.log('\n✅ Analysis complete');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTodayPayrolls();
