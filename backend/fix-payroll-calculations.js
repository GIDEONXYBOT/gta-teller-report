import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

async function fixPayrollCalculations() {
  try {
    await mongoose.connect('mongodb+srv://rmi_admin:rmi1234@rmi-teller-report.fphrmaw.mongodb.net/rmi?retryWrites=true&w=majority&connectTimeoutMS=30000&socketTimeoutMS=30000');

    console.log('🔧 Fixing Payroll Calculations - Removing Short/Over from Salary Calculations');
    console.log('================================================================================');

    // Get all payrolls that have over or short amounts
    const payrollsWithIssues = await Payroll.find({
      $or: [
        { over: { $gt: 0 } },
        { short: { $gt: 0 } }
      ]
    }).populate('user', 'username role baseSalary');

    console.log(`Found ${payrollsWithIssues.length} payrolls with short/over amounts affecting salary calculations\n`);

    for (const payroll of payrollsWithIssues) {
      const user = payroll.user;
      const baseSalary = payroll.baseSalary || 0;
      const over = payroll.over || 0;
      const short = payroll.short || 0;
      const deduction = payroll.deduction || 0;
      const withdrawal = payroll.withdrawal || 0;

      // Current (incorrect) calculation: base + over - short - deduction - withdrawal
      const currentTotal = payroll.totalSalary || 0;

      // Correct calculation: base - deduction - withdrawal (short/over tracked separately)
      const correctTotal = baseSalary - deduction - withdrawal;

      console.log(`${user?.username || 'Unknown'} (${user?.role || 'Unknown'}):`);
      console.log(`  Current: ₱${currentTotal} (includes over ₱${over} and short ₱${short})`);
      console.log(`  Correct: ₱${correctTotal} (base only, short/over tracked separately)`);

      if (currentTotal !== correctTotal) {
        // Update the payroll with correct calculation
        payroll.totalSalary = correctTotal;
        await payroll.save();
        console.log(`  ✅ FIXED: Updated total salary to ₱${correctTotal}`);
      } else {
        console.log(`  ℹ️  Already correct`);
      }
      console.log('');
    }

    console.log('🎉 Payroll calculations have been corrected!');
    console.log('💡 Short/Over amounts are now tracked separately and do not affect base salary calculations.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

fixPayrollCalculations();