import mongoose from 'mongoose';
import User from './models/User.js';
import Payroll from './models/Payroll.js';

async function createDailyPayrollsForAllTellers(targetDate = null) {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');
    console.log('✅ Connected to MongoDB');

    // Get target date (default to today, or use command line arg)
    let target = new Date();
    if (targetDate) {
      target = new Date(targetDate);
    }
    target.setHours(0, 0, 0, 0);
    const nextDay = new Date(target);
    nextDay.setDate(nextDay.getDate() + 1);

    const dateStr = target.toISOString().split('T')[0];
    console.log(`📅 Creating payrolls for: ${dateStr}`);

    // Get all active tellers and supervisors
    const users = await User.find({
      role: { $in: ['teller', 'supervisor'] },
      status: 'approved'
    }).select('name username role baseSalary');

    console.log(`👥 Found ${users.length} active tellers/supervisors`);

    let created = 0;
    let skipped = 0;

    for (const user of users) {
      // Check if payroll already exists for target date
      const existing = await Payroll.findOne({
        user: user._id,
        createdAt: { $gte: target, $lt: nextDay }
      });

      if (existing) {
        console.log(`⏭️  ${user.name || user.username}: Payroll already exists`);
        skipped++;
        continue;
      }

      // Create new payroll with base salary
      const baseSalary = user.baseSalary || 450;
      const newPayroll = await Payroll.create({
        user: user._id,
        role: user.role,
        baseSalary,
        over: 0,
        short: 0,
        deduction: 0,
        withdrawal: 0,
        totalSalary: baseSalary,
        date: dateStr,
        createdAt: target
      });

      console.log(`✅ ${user.name || user.username}: Created payroll - Base=₱${baseSalary}`);
      created++;
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Created: ${created} payrolls`);
    console.log(`   Skipped: ${skipped} (already existed)`);
    console.log(`   Total users: ${users.length}`);

    await mongoose.disconnect();
    console.log('\n✅ Done');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Allow command line date argument
const targetDate = process.argv[2];
createDailyPayrollsForAllTellers(targetDate);