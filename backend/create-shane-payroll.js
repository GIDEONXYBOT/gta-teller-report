import mongoose from 'mongoose';
import User from './models/User.js';
import Payroll from './models/Payroll.js';
import { computeTotalSalary } from './lib/payrollCalc.js';

(async () => {
  await mongoose.connect('mongodb://localhost:27017/rmi-teller-report');
  
  console.log('\n=== Creating Shane\'s missing payroll records ===\n');
  
  const shane = await User.findOne({ username: 'shane' });
  
  if (!shane) {
    console.log('❌ Shane not found');
    process.exit(1);
  }
  
  const payrollsToCreate = [
    {
      date: '2025-11-28',
      baseSalary: 450,
      over: 373,
      short: 0,
      daysPresent: 1,
      note: '11/28/2025 salary'
    },
    {
      date: '2025-11-29',
      baseSalary: 450,
      over: 174,
      short: 0,
      daysPresent: 1,
      note: '11/29/2025 salary'
    }
  ];
  
  for (const data of payrollsToCreate) {
    const totalSalary = computeTotalSalary({
      baseSalary: data.baseSalary,
      over: data.over,
      short: data.short,
      deduction: 0,
      withdrawal: 0,
      shortIsInstallment: true
    }, { period: 'daily' });
    
    const payroll = new Payroll({
      user: shane._id,
      role: shane.role,
      baseSalary: data.baseSalary,
      over: data.over,
      short: data.short,
      daysPresent: data.daysPresent,
      totalSalary: totalSalary,
      deduction: 0,
      withdrawal: 0,
      date: new Date(data.date),
      approved: false,
      locked: false,
      note: data.note,
      withdrawn: false,
      adjustments: []
    });
    
    await payroll.save();
    console.log(`✅ Created payroll for ${data.date}`);
    console.log(`   Base: ₱${data.baseSalary} + Over: ₱${data.over} = Total: ₱${totalSalary}\n`);
  }
  
  // Show all Shane's payroll records
  console.log('\n=== All of Shane\'s Payroll Records ===\n');
  const allPayrolls = await Payroll.find({ user: shane._id }).sort({ date: 1 });
  
  allPayrolls.forEach((p, i) => {
    console.log(`${i+1}. ${new Date(p.date).toLocaleDateString()}`);
    console.log(`   Base: ₱${p.baseSalary} + Over: ₱${p.over} - Short: ₱${p.short} = Total: ₱${p.totalSalary}`);
  });
  
  console.log(`\n✅ Total payroll records for Shane: ${allPayrolls.length}`);
  
  process.exit(0);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
