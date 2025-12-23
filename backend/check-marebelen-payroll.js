import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkMarebelenPayroll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find Marebelen user
    const marebelen = await User.findOne({
      $or: [
        { username: /marebelen/i },
        { name: /marebelen/i }
      ]
    });

    if (!marebelen) {
      console.log('❌ Marebelen not found');
      await mongoose.disconnect();
      return;
    }

    console.log(`👤 Found: ${marebelen.name} (${marebelen.username})`);
    console.log(`   User ID: ${marebelen._id}`);
    console.log(`   Role: ${marebelen.role}\n`);

    // Get all payrolls for Marebelen
    const payrolls = await Payroll.find({ user: marebelen._id })
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

    if (hasDuplicates) {
      console.log('⚠️  DUPLICATES FOUND for Marebelen!');
    } else {
      console.log('✅ No duplicates - each date has exactly 1 payroll');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkMarebelenPayroll();
