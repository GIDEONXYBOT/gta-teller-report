import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';

async function checkRecentPayrolls() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');

    // Get payrolls from yesterday and today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    console.log(`Checking payrolls from ${yesterday.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}\n`);

    const payrolls = await Payroll.find({
      createdAt: { $gte: yesterday }
    }).sort({ createdAt: -1 });

    console.log(`Found ${payrolls.length} payrolls:\n`);

    payrolls.forEach((p, i) => {
      const date = p.createdAt.toISOString().split('T')[0];
      console.log(`${i+1}. User: ${p.user}, Role: ${p.role}`);
      console.log(`   Base Salary: ₱${p.baseSalary}, Total: ₱${p.totalSalary}`);
      console.log(`   Date: ${date}, Created: ${p.createdAt}`);
      console.log('');
    });

    // Check for tellers without payrolls
    const User = mongoose.model('User', new mongoose.Schema({
      name: String,
      username: String,
      role: String,
      baseSalary: Number
    }));

    const tellers = await User.find({ role: 'teller' });
    console.log(`\nTotal tellers: ${tellers.length}`);

    const payrollUserIds = new Set(payrolls.map(p => p.user.toString()));
    const tellersWithoutPayroll = tellers.filter(t => !payrollUserIds.has(t._id.toString()));

    console.log(`Tellers without recent payroll: ${tellersWithoutPayroll.length}`);
    tellersWithoutPayroll.forEach(t => {
      console.log(`  - ${t.name || t.username} (${t.baseSalary})`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRecentPayrolls();