import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function checkShymaine() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find Shymaine
    const shymaine = await User.findOne({
      $or: [
        { username: /shymaine/i },
        { name: /shymaine/i }
      ]
    });

    if (!shymaine) {
      console.log('❌ Shymaine not found');
      await mongoose.disconnect();
      return;
    }

    console.log(`👤 Found: ${shymaine.name || shymaine.username}`);
    console.log(`   ID: ${shymaine._id}`);
    console.log(`   Role: ${shymaine.role}`);
    console.log(`   Base Salary: ₱${shymaine.baseSalary}`);
    console.log('');

    // Get payroll entries
    const payrolls = await Payroll.find({ user: shymaine._id })
      .sort({ createdAt: -1 });

    console.log(`📋 Payroll Entries (${payrolls.length}):`);
    for (const p of payrolls) {
      const date = new Date(p.createdAt).toISOString().split('T')[0];
      const daysPresent = p.daysPresent || 1;
      const overPerDay = daysPresent > 0 ? (p.over || 0) / daysPresent : 0;
      
      console.log(`\n   ${date}:`);
      console.log(`   - Base: ₱${p.baseSalary}`);
      console.log(`   - Over: ₱${p.over}`);
      console.log(`   - Days Present: ${daysPresent}`);
      console.log(`   - Over Per Day: ₱${overPerDay.toFixed(2)}`);
      console.log(`   - Short: ₱${p.short}`);
      console.log(`   - Deduction: ₱${p.deduction}`);
      console.log(`   - Withdrawal: ₱${p.withdrawal}`);
      console.log(`   - Total Salary: ₱${p.totalSalary}`);
      console.log(`   - Approved: ${p.approved ? '✅' : '❌'}`);
    }

    // Get teller reports
    console.log(`\n\n📊 Teller Reports (${await TellerReport.find({ user: shymaine._id }).countDocuments()}):`);
    const reports = await TellerReport.find({ user: shymaine._id })
      .sort({ date: -1 })
      .limit(10);

    for (const report of reports) {
      const over = report.over || 0;
      const short = report.short || 0;
      console.log(`\n   ${report.date}:`);
      console.log(`   - Over: ₱${over}`);
      console.log(`   - Short: ₱${short}`);
      console.log(`   - Cash: ₱${report.cash}`);
      console.log(`   - Check: ₱${report.check}`);
      console.log(`   - Note: ${report.note || 'N/A'}`);
    }

    console.log('\n\n🔍 Analysis:');
    if (payrolls.length > 0) {
      const latestPayroll = payrolls[0];
      console.log(`   Latest payroll created: ${new Date(latestPayroll.createdAt).toISOString()}`);
      console.log(`   Over: ₱${latestPayroll.over}`);
      console.log(`   Days Present: ${latestPayroll.daysPresent}`);
      
      const overPerDay = latestPayroll.daysPresent > 0 
        ? (latestPayroll.over / latestPayroll.daysPresent).toFixed(2)
        : '0.00';
      
      console.log(`   Over Per Day: ₱${overPerDay}`);
      
      // Check if over is showing in UI
      if (latestPayroll.over === 0) {
        console.log(`\n   ⚠️  Over is 0 - might not display properly in UI`);
      } else {
        console.log(`\n   ✅ Over amount exists`);
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkShymaine();
