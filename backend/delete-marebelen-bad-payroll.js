import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function deleteMarebelenBadPayroll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find the problematic payroll
    const badPayroll = await Payroll.findById('6912e9c398a80a9914ecc33a');

    if (!badPayroll) {
      console.log('❌ Payroll not found');
      await mongoose.disconnect();
      return;
    }

    console.log('🗑️  About to delete payroll:');
    console.log(`   ID: ${badPayroll._id}`);
    console.log(`   Date: Nov 10, 2025`);
    console.log(`   Base: ₱${badPayroll.baseSalary}`);
    console.log(`   Over: ₱${badPayroll.over} (INCORRECT AMOUNT)`);
    console.log(`   Total: ₱${badPayroll.totalSalary}`);
    console.log('');

    // Delete it
    await Payroll.deleteOne({ _id: badPayroll._id });
    console.log('✅ Deleted the incorrect Nov 10 payroll');

    // Verify
    const remaining = await Payroll.find({ user: badPayroll.user })
      .sort({ createdAt: 1 })
      .lean();

    console.log(`\n📊 Remaining payrolls for Marebelen: ${remaining.length}`);
    remaining.forEach((p, i) => {
      const date = new Date(p.createdAt);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      console.log(`   ${i + 1}. ${dateStr}: Base ₱${p.baseSalary}, Over ₱${p.over}, Total ₱${p.totalSalary}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

deleteMarebelenBadPayroll();
