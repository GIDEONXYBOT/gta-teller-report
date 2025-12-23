import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payroll from './models/Payroll.js';
import SystemSettings from './models/SystemSettings.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function fixSantaSalary() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find Santa
    const santa = await User.findOne({ name: /santa/i });
    if (!santa) {
      console.log('❌ Santa not found');
      process.exit(1);
    }

    console.log('👤 Current Santa Info:');
    console.log('   Name:', santa.name);
    console.log('   Username:', santa.username);
    console.log('   Role:', santa.role);
    console.log('   Base Salary:', santa.baseSalary);
    console.log('   Supervisor ID:', santa.supervisorId);

    // Get teller base salary from settings
    const settings = await SystemSettings.findOne().lean();
    const tellerBase = settings?.baseSalary?.teller || 450;

    console.log(`\n💰 Teller base salary from settings: ₱${tellerBase}`);

    // Update Santa's base salary to teller rate
    if (santa.baseSalary !== tellerBase) {
      santa.baseSalary = tellerBase;
      await santa.save();
      console.log(`\n✅ Updated Santa's base salary to ₱${tellerBase}`);
    } else {
      console.log(`\n✓ Santa's base salary is already ₱${tellerBase}`);
    }

    // Update all of Santa's payrolls this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const payrolls = await Payroll.find({
      user: santa._id,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    console.log(`\n📊 Found ${payrolls.length} payroll records this month`);

    for (const payroll of payrolls) {
      if (payroll.baseSalary !== tellerBase) {
        console.log(`   Updating payroll from ₱${payroll.baseSalary} to ₱${tellerBase}`);
        payroll.baseSalary = tellerBase;
        payroll.totalSalary = tellerBase + (payroll.over || 0) - (payroll.short || 0) - (payroll.deduction || 0) - (payroll.withdrawal || 0);
        await payroll.save();
      }
    }

    console.log('\n✅ Santa salary fix complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

fixSantaSalary();
