import mongoose from 'mongoose';
import User from './models/User.js';
import Payroll from './models/Payroll.js';

(async () => {
  // Connect to LOCAL database
  await mongoose.connect('mongodb://localhost:27017/rmi-teller-report');
  
  console.log('\n=== LOCAL DATABASE CONTENTS ===\n');
  
  // Get all users
  const allUsers = await User.find().sort({ name: 1 });
  console.log(`📋 Total users: ${allUsers.length}\n`);
  
  allUsers.forEach(u => {
    console.log(`${u.name} (${u.username}) - Role: ${u.role}, Base Salary: ₱${u.baseSalary || 0}`);
  });
  
  // Get all payroll records grouped by user
  console.log(`\n\n📊 PAYROLL RECORDS BY USER\n`);
  
  const allPayrolls = await Payroll.find().populate('user', 'name username').sort({ date: -1 });
  console.log(`Total payroll records: ${allPayrolls.length}\n`);
  
  const byUser = {};
  allPayrolls.forEach(p => {
    const name = p.user?.name || 'Unknown';
    if (!byUser[name]) byUser[name] = [];
    byUser[name].push(p);
  });
  
  Object.entries(byUser).forEach(([name, records]) => {
    console.log(`\n${name}: ${records.length} records`);
    records.forEach((r, i) => {
      console.log(`  ${i+1}. ${new Date(r.date || r.createdAt).toLocaleDateString()} - Base: ₱${r.baseSalary} | Over: ₱${r.over} | Short: ₱${r.short} | Total: ₱${r.totalSalary}`);
    });
  });
  
  process.exit(0);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
