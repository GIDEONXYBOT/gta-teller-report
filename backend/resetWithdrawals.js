// resetWithdrawals.js
// Reset all withdrawal-related fields in payrolls and delete withdrawal records
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payroll from './models/Payroll.js';
import Withdrawal from './models/Withdrawal.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  try {
    console.log('Connecting to', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Count current withdrawals
    const withdrawalCount = await Withdrawal.countDocuments();
    console.log(`Found ${withdrawalCount} withdrawal records\n`);

    // Delete all withdrawal records
    if (withdrawalCount > 0) {
      const deleteResult = await Withdrawal.deleteMany({});
      console.log(`✅ Deleted ${deleteResult.deletedCount} withdrawal records\n`);
    }

    // Find all payrolls with withdrawal data
    const payrollsWithWithdrawals = await Payroll.find({
      $or: [
        { withdrawn: true },
        { withdrawal: { $gt: 0 } },
        { withdrawnAt: { $exists: true } }
      ]
    }).populate('user', 'name username').lean();

    console.log(`Found ${payrollsWithWithdrawals.length} payrolls with withdrawal data\n`);

    let resetCount = 0;

    for (const payroll of payrollsWithWithdrawals) {
      const user = payroll.user;
      
      console.log(`🔄 ${user?.name || user?.username || 'Unknown'}`);
      console.log(`   Payroll ID: ${payroll._id}`);
      console.log(`   Was withdrawn: ${payroll.withdrawn}`);
      console.log(`   Withdrawal amount: ₱${payroll.withdrawal || 0}`);
      
      // Recalculate totalSalary without withdrawal deduction
      const newTotal = (Number(payroll.baseSalary) || 0) + 
                      (Number(payroll.over) || 0) - 
                      (Number(payroll.short) || 0) - 
                      (Number(payroll.deduction) || 0);

      console.log(`   Old total: ₱${payroll.totalSalary || 0}`);
      console.log(`   New total: ₱${newTotal}`);

      // Reset withdrawal fields
      await Payroll.findByIdAndUpdate(payroll._id, {
        $set: {
          withdrawn: false,
          withdrawal: 0,
          totalSalary: newTotal
        },
        $unset: {
          withdrawnAt: ""
        }
      });

      console.log(`   ✅ Reset!\n`);
      resetCount++;
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Withdrawal records deleted: ${withdrawalCount}`);
    console.log(`Payrolls reset: ${resetCount}`);
    console.log(`\n✅ All withdrawals reset!`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
