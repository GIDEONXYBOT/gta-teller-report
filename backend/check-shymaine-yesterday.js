import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function checkYesterdayPayroll() {
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

    console.log(`👤 User: ${shymaine.name || shymaine.username}`);
    console.log(`   ID: ${shymaine._id}`);
    console.log(`   Role: ${shymaine.role}`);
    console.log(`   Base Salary: ₱${shymaine.baseSalary}\n`);

    // Yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateStr = yesterday.toISOString().split('T')[0];
    const yesterdayStart = new Date(yesterdayDateStr + 'T00:00:00Z');
    const yesterdayEnd = new Date(yesterdayDateStr + 'T23:59:59Z');

    console.log(`📅 Checking for: ${yesterdayDateStr}\n`);

    // Check for payroll yesterday
    const payrolls = await Payroll.find({
      user: shymaine._id,
      createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd }
    });

    console.log(`💰 Payroll Entries (${payrolls.length}):`);
    if (payrolls.length === 0) {
      console.log('   ❌ No payroll entry found for yesterday');
    } else {
      for (const p of payrolls) {
        const daysPresent = p.daysPresent || 1;
        const overPerDay = daysPresent > 0 ? (p.over || 0) / daysPresent : 0;
        
        console.log(`\n   Created: ${new Date(p.createdAt).toLocaleString()}`);
        console.log(`   Base: ₱${p.baseSalary}`);
        console.log(`   Over: ₱${p.over} (₱${overPerDay.toFixed(2)}/day)`);
        console.log(`   Short: ₱${p.short}`);
        console.log(`   Days Present: ${daysPresent}`);
        console.log(`   Deduction: ₱${p.deduction}`);
        console.log(`   Withdrawal: ₱${p.withdrawal}`);
        console.log(`   Total: ₱${p.totalSalary}`);
        console.log(`   Approved: ${p.approved ? '✅ Yes' : '❌ No'}`);
        console.log(`   Locked: ${p.locked ? '🔒 Yes' : '🔓 No'}`);
      }
    }

    // Check for teller reports yesterday
    const reports = await TellerReport.find({
      user: shymaine._id,
      date: yesterdayDateStr
    });

    console.log(`\n📊 Teller Reports (${reports.length}):`);
    if (reports.length === 0) {
      console.log('   ❌ No teller report found for yesterday');
    } else {
      for (const r of reports) {
        console.log(`\n   Date: ${r.date}`);
        console.log(`   Cash: ₱${r.cash || 0}`);
        console.log(`   Check: ₱${r.check || 0}`);
        console.log(`   System: ₱${r.system || 0}`);
        console.log(`   Over: ₱${r.over || 0}`);
        console.log(`   Short: ₱${r.short || 0}`);
        console.log(`   Note: ${r.note || 'N/A'}`);
      }
    }

    // Also check the past 3 days for context
    console.log(`\n\n📈 Past 7 Days Summary:`);
    console.log('─'.repeat(70));
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const pastPayrolls = await Payroll.find({
      user: shymaine._id,
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: -1 });

    if (pastPayrolls.length === 0) {
      console.log('   No payroll entries in past 7 days');
    } else {
      for (const p of pastPayrolls) {
        const date = new Date(p.createdAt).toISOString().split('T')[0];
        const daysPresent = p.daysPresent || 1;
        const overPerDay = daysPresent > 0 ? (p.over || 0) / daysPresent : 0;
        const status = p.approved ? '✅' : '⏳';
        
        console.log(`${date} | Base: ₱${p.baseSalary} | Over: ₱${p.over} (₱${overPerDay.toFixed(2)}/day) | Total: ₱${p.totalSalary} | ${status}`);
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkYesterdayPayroll();
