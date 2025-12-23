import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import TellerReport from './models/TellerReport.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkErikaPayroll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find Erika
    const erika = await User.findOne({
      $or: [
        { username: /erika/i },
        { name: /erika/i }
      ]
    });

    if (!erika) {
      console.log('❌ Erika not found');
      await mongoose.disconnect();
      return;
    }

    console.log(`👤 Found: ${erika.name} (${erika.username})`);
    console.log(`   User ID: ${erika._id}`);
    console.log(`   Role: ${erika.role}\n`);

    // Get all payrolls for Erika
    const payrolls = await Payroll.find({ user: erika._id })
      .sort({ createdAt: 1 })
      .lean();

    console.log(`💰 Total payrolls: ${payrolls.length}\n`);

    if (payrolls.length === 0) {
      console.log('⚠️  No payrolls found');
      await mongoose.disconnect();
      return;
    }

    // Group by date
    const byDate = new Map();
    payrolls.forEach(p => {
      const date = new Date(p.createdAt || p.date);
      const dateKey = date.toISOString().split('T')[0];
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey).push(p);
    });

    // Check for duplicates
    console.log('📅 Payrolls by date:\n');
    let hasDuplicates = false;

    for (const [dateKey, datePayrolls] of byDate) {
      const date = new Date(dateKey);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      if (datePayrolls.length > 1) {
        hasDuplicates = true;
        console.log(`❌ ${dateStr} - ${datePayrolls.length} payrolls (DUPLICATE!):`);
        datePayrolls.forEach((p, i) => {
          console.log(`   ${i + 1}. ID: ${p._id}`);
          console.log(`      Base: ₱${p.baseSalary}, Over: ₱${p.over}, Short: ₱${p.short}`);
          console.log(`      Total: ₱${p.totalSalary}`);
          console.log(`      Created: ${new Date(p.createdAt).toISOString()}`);
          console.log(`      Approved: ${p.approved ? '✅' : '❌'}, Locked: ${p.locked ? '🔒' : '🔓'}`);
        });
      } else {
        const p = datePayrolls[0];
        console.log(`✅ ${dateStr} - 1 payroll`);
        console.log(`   ID: ${p._id}`);
        console.log(`   Base: ₱${p.baseSalary}, Over: ₱${p.over}, Short: ₱${p.short}, Total: ₱${p.totalSalary}`);
        console.log(`   Approved: ${p.approved ? '✅' : '❌'}, Locked: ${p.locked ? '🔒' : '🔓'}`);
      }
      console.log('');
    }

    // Get all teller reports for Erika
    const reports = await TellerReport.find({ user: erika._id })
      .sort({ createdAt: 1 })
      .lean();

    console.log(`📝 Total teller reports: ${reports.length}\n`);
    
    if (reports.length === 0) {
      console.log('⚠️  No teller reports found');
    } else {
      console.log('All Teller Reports:\n');
      reports.forEach((r, i) => {
        const date = new Date(r.createdAt);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        console.log(`${i + 1}. ${dateStr}`);
        console.log(`   ID: ${r._id}`);
        console.log(`   Over: ₱${r.over || 0}, Short: ₱${r.short || 0}`);
        console.log(`   Created: ${r.createdAt}`);
        console.log('');
      });
    }

    if (hasDuplicates) {
      console.log('⚠️  DUPLICATES FOUND for Erika!');
    } else {
      console.log('✅ No duplicates - each date has exactly 1 payroll');
    }

    // Check from image: Erika should have over amounts of 67 and 312
    const overAmounts = payrolls.map(p => p.over);
    console.log(`\n📊 Expected from image: Over amounts [67, 312]`);
    console.log(`   Actual over amounts: [${overAmounts.join(', ')}]`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkErikaPayroll();
