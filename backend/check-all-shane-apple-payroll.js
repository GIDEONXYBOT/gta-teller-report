import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

(async () => {
  await mongoose.connect('mongodb://localhost:27017/rmi-teller-report');
  
  console.log('\n=== CHECKING ALL PAYROLL RECORDS ===\n');
  
  const shaneUser = await User.findOne({ username: 'shane' });
  const appleUser = await User.findOne({ username: 'apple' });
  
  if (shaneUser) {
    console.log(`\n📍 SHANE Records (User ID: ${shaneUser._id}):`);
    const shanePayrolls = await Payroll.find({ user: shaneUser._id }).sort({ date: 1 });
    
    if (shanePayrolls.length === 0) {
      console.log('  No payroll records found');
    } else {
      shanePayrolls.forEach((p, i) => {
        console.log(`\n  Record ${i+1}:`);
        console.log(`    Date: ${new Date(p.date || p.createdAt).toLocaleDateString()}`);
        console.log(`    Base: ₱${p.baseSalary || 0}`);
        console.log(`    Over: ₱${p.over || 0}`);
        console.log(`    Short: ₱${p.short || 0}`);
        console.log(`    Deduction: ₱${p.deduction || 0}`);
        console.log(`    Withdrawal: ₱${p.withdrawal || 0}`);
        console.log(`    Total: ₱${p.totalSalary || 'NOT SET'}`);
        console.log(`    Approved: ${p.approved}`);
      });
    }
  }
  
  if (appleUser) {
    console.log(`\n\n📍 APPLE Records (User ID: ${appleUser._id}):`);
    const applePayrolls = await Payroll.find({ user: appleUser._id }).sort({ date: 1 });
    
    if (applePayrolls.length === 0) {
      console.log('  No payroll records found');
    } else {
      applePayrolls.forEach((p, i) => {
        console.log(`\n  Record ${i+1}:`);
        console.log(`    Date: ${new Date(p.date || p.createdAt).toLocaleDateString()}`);
        console.log(`    Base: ₱${p.baseSalary || 0}`);
        console.log(`    Over: ₱${p.over || 0}`);
        console.log(`    Short: ₱${p.short || 0}`);
        console.log(`    Deduction: ₱${p.deduction || 0}`);
        console.log(`    Withdrawal: ₱${p.withdrawal || 0}`);
        console.log(`    Total: ₱${p.totalSalary || 'NOT SET'}`);
        console.log(`    Approved: ${p.approved}`);
      });
    }
  }
  
  console.log('\n\n=== SUMMARY ===');
  const totalPayrolls = await Payroll.countDocuments();
  const shanePayrollCount = shaneUser ? await Payroll.countDocuments({ user: shaneUser._id }) : 0;
  const applePayrollCount = appleUser ? await Payroll.countDocuments({ user: appleUser._id }) : 0;
  
  console.log(`Total payroll records in DB: ${totalPayrolls}`);
  console.log(`Shane's records: ${shanePayrollCount}`);
  console.log(`Apple's records: ${applePayrollCount}`);
  
  process.exit(0);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
