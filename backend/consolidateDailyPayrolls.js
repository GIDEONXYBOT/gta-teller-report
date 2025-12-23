// consolidateDailyPayrolls.js
// Ensure each user has only ONE payroll per date (not multiple per day)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payroll from './models/Payroll.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  try {
    console.log('Connecting to', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Get all payrolls
    const allPayrolls = await Payroll.find({})
      .populate('user', 'name username role baseSalary')
      .sort({ createdAt: 1 })
      .lean();

    console.log(`Found ${allPayrolls.length} total payrolls\n`);

    // Group by user + date
    const payrollsByUserDate = new Map();
    
    for (const payroll of allPayrolls) {
      if (!payroll.user || !payroll.user._id) {
        console.log(`⚠️  Skipping payroll ${payroll._id} - no user reference`);
        continue;
      }

      const userId = String(payroll.user._id);
      const dateKey = payroll.date || payroll.createdAt?.toISOString().split('T')[0] || 'no-date';
      const key = `${userId}|${dateKey}`;

      if (!payrollsByUserDate.has(key)) {
        payrollsByUserDate.set(key, []);
      }
      payrollsByUserDate.get(key).push(payroll);
    }

    console.log(`Found ${payrollsByUserDate.size} unique user+date combinations\n`);

    let consolidated = 0;
    let deleted = 0;
    let skipped = 0;

    for (const [key, payrolls] of payrollsByUserDate) {
      const [userId, dateKey] = key.split('|');
      
      if (payrolls.length === 1) {
        skipped++;
        continue;
      }

      const user = payrolls[0].user;
      console.log(`\n🔄 ${user.name || user.username} on ${dateKey} - Consolidating ${payrolls.length} payrolls`);

      // Sum all values
      const totalBaseSalary = payrolls.reduce((sum, p) => sum + (Number(p.baseSalary) || 0), 0);
      const totalOver = payrolls.reduce((sum, p) => sum + (Number(p.over) || 0), 0);
      const totalShort = payrolls.reduce((sum, p) => sum + (Number(p.short) || 0), 0);
      const totalDeduction = payrolls.reduce((sum, p) => sum + (Number(p.deduction) || 0), 0);
      const totalWithdrawal = payrolls.reduce((sum, p) => sum + (Number(p.withdrawal) || 0), 0);
      const daysPresent = Math.max(...payrolls.map(p => p.daysPresent || 1));

      // Calculate total salary: base - deduction - withdrawal
      // Short/Over amounts are tracked separately for financial reporting only
      const totalSalary = totalBaseSalary - totalDeduction - totalWithdrawal;

      console.log(`   Base: ₱${totalBaseSalary}, Over: ₱${totalOver}, Short: ₱${totalShort}`);
      console.log(`   Total: ₱${totalSalary}`);

      // Keep the first payroll, update it
      const keepPayroll = payrolls[0];
      await Payroll.findByIdAndUpdate(keepPayroll._id, {
        $set: {
          baseSalary: totalBaseSalary,
          over: totalOver,
          short: totalShort,
          deduction: totalDeduction,
          withdrawal: totalWithdrawal,
          totalSalary: totalSalary,
          daysPresent: daysPresent,
          date: dateKey,
        }
      });

      console.log(`   ✅ Updated payroll ${keepPayroll._id}`);

      // Delete duplicates
      const deleteIds = payrolls.slice(1).map(p => p._id);
      const deleteResult = await Payroll.deleteMany({ _id: { $in: deleteIds } });
      deleted += deleteResult.deletedCount;

      console.log(`   🗑️  Deleted ${deleteResult.deletedCount} duplicate payrolls`);

      consolidated++;
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total user+date combinations: ${payrollsByUserDate.size}`);
    console.log(`Consolidated (had duplicates): ${consolidated}`);
    console.log(`Skipped (already unique): ${skipped}`);
    console.log(`Total payrolls deleted: ${deleted}`);
    console.log(`\n✅ Daily consolidation complete!`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
