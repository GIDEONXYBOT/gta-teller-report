import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkMaryGoldPayroll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find Mary Gold
    const maryGold = await User.findOne({
      $or: [
        { username: /mary.*gold/i },
        { name: /mary.*gold/i }
      ]
    });

    if (!maryGold) {
      console.log('❌ Mary Gold not found');
      await mongoose.disconnect();
      return;
    }

    console.log(`👤 Found: ${maryGold.name} (${maryGold.username})`);
    console.log(`   User ID: ${maryGold._id}`);
    console.log(`   Base Salary: ₱${maryGold.baseSalary}\n`);

    // Get all payrolls for Mary Gold
    const payrolls = await Payroll.find({ user: maryGold._id })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`💰 Total payrolls: ${payrolls.length}\n`);

    if (payrolls.length === 0) {
      console.log('⚠️  No payrolls found');
      await mongoose.disconnect();
      return;
    }

    console.log('📅 All Payrolls:\n');
    payrolls.forEach((p, i) => {
      const date = new Date(p.createdAt);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      console.log(`${i + 1}. ${dateStr}`);
      console.log(`   ID: ${p._id}`);
      console.log(`   Base Salary: ₱${p.baseSalary}`);
      console.log(`   Over: ₱${p.over}`);
      console.log(`   Short: ₱${p.short}`);
      console.log(`   Short Payment Terms: ${p.shortPaymentTerms || 1} weeks`);
      console.log(`   Deduction: ₱${p.deduction || 0}`);
      console.log(`   Total Salary: ₱${p.totalSalary}`);
      console.log(`   Approved: ${p.approved ? '✅' : '❌'}`);
      
      // Calculate what total SHOULD be
      const terms = p.shortPaymentTerms || 1;
      const weeklyShort = p.short / terms;
      const expectedTotal = p.baseSalary + p.over - weeklyShort - (p.deduction || 0);
      console.log(`   Expected Total: ₱${expectedTotal.toFixed(2)} (Short: ₱${p.short} / ${terms} weeks = ₱${weeklyShort.toFixed(2)}/week)`);
      
      if (Math.abs(p.totalSalary - expectedTotal) > 0.01) {
        console.log(`   ⚠️  MISMATCH! Difference: ₱${(expectedTotal - p.totalSalary).toFixed(2)}`);
      } else {
        console.log(`   ✅ Total is correct`);
      }
      
      if (p.adjustments && p.adjustments.length > 0) {
        console.log(`   Adjustments: ${p.adjustments.length}`);
        p.adjustments.forEach((adj, idx) => {
          console.log(`     ${idx + 1}. Delta: ₱${adj.delta}, Reason: ${adj.reason || 'None'}`);
        });
      }
      console.log('');
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkMaryGoldPayroll();
