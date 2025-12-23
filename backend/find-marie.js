import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

(async () => {
  await mongoose.connect('mongodb://localhost:27017/rmi-teller-report');
  
  console.log('\n=== SEARCHING FOR MARIE ===\n');
  
  const marie = await User.findOne({ $or: [
    { username: /marie/i },
    { name: /marie/i },
    { employeeId: /017.marie/i }
  ]});
  
  if (marie) {
    console.log(`Found: ${marie.name} (${marie.username})`);
    console.log(`Employee ID: ${marie.employeeId}`);
    console.log(`User ID: ${marie._id}\n`);
    
    const payrolls = await Payroll.find({ user: marie._id }).sort({ date: -1 });
    console.log(`Total payroll records: ${payrolls.length}\n`);
    
    payrolls.forEach((p, i) => {
      console.log(`Record ${i+1}:`);
      console.log(`  Date: ${new Date(p.date || p.createdAt).toLocaleDateString()}`);
      console.log(`  Base: ₱${p.baseSalary || 0} | Over: ₱${p.over || 0} | Short: ₱${p.short || 0}`);
      console.log(`  Total: ₱${p.totalSalary || 'NOT SET'}`);
      console.log();
    });
  } else {
    console.log('No user named Marie found');
  }
  
  process.exit(0);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
