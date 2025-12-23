import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

async function checkPayrollCalculations() {
  try {
    await mongoose.connect('mongodb+srv://rmi_admin:rmi1234@rmi-teller-report.fphrmaw.mongodb.net/rmi?retryWrites=true&w=majority&connectTimeoutMS=30000&socketTimeoutMS=30000');

    // Get today's payrolls
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const todayPayrolls = await Payroll.find({
      createdAt: {
        $gte: new Date(todayStr + 'T00:00:00.000Z'),
        $lt: new Date(todayStr + 'T23:59:59.999Z')
      }
    }).populate('user', 'username role baseSalary').sort({ createdAt: -1 });

    console.log('📊 Today\'s Payroll Calculations (' + todayStr + '):');
    console.log('================================================');

    todayPayrolls.forEach((payroll, index) => {
      const user = payroll.user;
      const baseSalary = payroll.baseSalary || 0;
      const over = payroll.over || 0;
      const short = payroll.short || 0;
      const deduction = payroll.deduction || 0;
      const withdrawal = payroll.withdrawal || 0;
      const totalSalary = payroll.totalSalary || 0;

      // Current calculation: base + over - short - deduction - withdrawal
      const expectedTotal = baseSalary + over - short - deduction - withdrawal;

      console.log((index + 1) + '. ' + (user?.username || 'Unknown') + ' (' + (user?.role || 'Unknown') + ')');
      console.log('   Base Salary: ₱' + baseSalary);
      console.log('   Over: ₱' + over + ' (currently ADDED to salary)');
      console.log('   Short: ₱' + short + ' (currently SUBTRACTED from salary)');
      console.log('   Deduction: ₱' + deduction);
      console.log('   Withdrawal: ₱' + withdrawal);
      console.log('   Current Total: ₱' + totalSalary);
      console.log('   Expected Total: ₱' + expectedTotal);

      if (totalSalary !== expectedTotal) {
        console.log('   ⚠️  MISMATCH DETECTED!');
      }

      if (over > 0 || short > 0) {
        console.log('   ❌ PROBLEM: Short/Over amounts are affecting salary calculation');
      }

      console.log('');
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkPayrollCalculations();