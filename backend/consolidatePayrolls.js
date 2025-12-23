// consolidatePayrolls.js
// Consolidate multiple daily payrolls per user into a single monthly payroll
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

    // November 2025: 2025-11-01 to 2025-11-30
    const start = new Date('2025-11-01T00:00:00.000Z');
    const end = new Date('2025-11-30T23:59:59.999Z');

    console.log(`Consolidating payrolls for November 2025`);
    console.log(`Date range: ${start.toISOString()} to ${end.toISOString()}\n`);

    // Find all payrolls in November 2025
    const allPayrolls = await Payroll.find({
      $or: [
        { date: { $gte: '2025-11-01', $lte: '2025-11-30' } },
        { createdAt: { $gte: start, $lte: end } }
      ]
    }).populate('user', 'name username role baseSalary').lean();

    console.log(`Found ${allPayrolls.length} total payrolls in November 2025\n`);

    // Group payrolls by user
    const payrollsByUser = new Map();
    for (const payroll of allPayrolls) {
      if (!payroll.user || !payroll.user._id) {
        console.log(`⚠️  Skipping payroll ${payroll._id} - no user reference`);
        continue;
      }
      const userId = String(payroll.user._id);
      if (!payrollsByUser.has(userId)) {
        payrollsByUser.set(userId, []);
      }
      payrollsByUser.get(userId).push(payroll);
    }

    console.log(`Found ${payrollsByUser.size} unique users with payrolls\n`);

    let processed = 0;
    let consolidated = 0;
    let deleted = 0;

    for (const [userId, payrolls] of payrollsByUser) {
      try {
        const user = payrolls[0].user;
        
        if (payrolls.length === 1) {
          console.log(`ℹ️  ${user.name || user.username} - Only 1 payroll, skipping`);
          continue;
        }

        console.log(`\n🔄 ${user.name || user.username} - Consolidating ${payrolls.length} payrolls`);

        // Calculate accumulated totals
        const totalBaseSalary = payrolls.reduce((sum, p) => sum + (Number(p.baseSalary) || 0), 0);
        const totalOver = payrolls.reduce((sum, p) => sum + (Number(p.over) || 0), 0);
        const totalShort = payrolls.reduce((sum, p) => sum + (Number(p.short) || 0), 0);
        const totalDeduction = payrolls.reduce((sum, p) => sum + (Number(p.deduction) || 0), 0);
        const totalWithdrawal = payrolls.reduce((sum, p) => sum + (Number(p.withdrawal) || 0), 0);
        const daysPresent = payrolls.length;

        // Calculate total salary: base - deduction - withdrawal
        // Short/Over amounts are tracked separately for financial reporting only
        const totalSalary = totalBaseSalary - totalDeduction - totalWithdrawal;

        console.log(`   Days present: ${daysPresent}`);
        console.log(`   Base salary: ₱${totalBaseSalary}`);
        console.log(`   Over: ₱${totalOver}`);
        console.log(`   Short: ₱${totalShort}`);
        console.log(`   Deduction: ₱${totalDeduction}`);
        console.log(`   Total salary: ₱${totalSalary}`);

        // Keep the first payroll, update it with consolidated values
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
            date: '2025-11-01', // Set to month start
          }
        });

        console.log(`   ✅ Updated payroll ${keepPayroll._id}`);

        // Delete the rest
        const deleteIds = payrolls.slice(1).map(p => p._id);
        const deleteResult = await Payroll.deleteMany({ _id: { $in: deleteIds } });
        deleted += deleteResult.deletedCount;

        console.log(`   🗑️  Deleted ${deleteResult.deletedCount} duplicate payrolls`);

        consolidated++;
        processed++;

      } catch (e) {
        console.error(`❌ Error processing user ${userId}:`, e.message);
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total users: ${payrollsByUser.size}`);
    console.log(`Processed (consolidated): ${processed}`);
    console.log(`Total payrolls deleted: ${deleted}`);
    console.log('\n✅ Consolidation complete!');

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
