import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

(async () => {
  await mongoose.connect('mongodb://localhost:27017/rmi-teller-report');
  
  const payrolls = await Payroll.find().populate('user', 'name username role baseSalary').sort({ createdAt: -1 }).limit(10);
  
  console.log('\n📊 Recent Payroll Records:', payrolls.length);
  payrolls.forEach((p, i) => {
    console.log(`\n${i+1}. User: ${p.user?.name || 'N/A'} (${p.user?.role})`);
    console.log(`   Date: ${new Date(p.date || p.createdAt).toLocaleDateString()}`);
    console.log(`   baseSalary: ₱${p.baseSalary || 0}`);
    console.log(`   over: ₱${p.over || 0}`);
    console.log(`   short: ₱${p.short || 0}`);
    console.log(`   deduction: ₱${p.deduction || 0}`);
    console.log(`   withdrawal: ₱${p.withdrawal || 0}`);
    console.log(`   totalSalary: ₱${p.totalSalary || 0}`);
  });
  
  process.exit(0);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
