import mongoose from 'mongoose';
import User from './models/User.js';
import Payroll from './models/Payroll.js';

(async () => {
  // Connect to Cloud Atlas production database
  const CLOUD_ATLAS_URI = 'mongodb+srv://rmi_admin:rmi1234@rmi-teller-report.fphrmaw.mongodb.net/rmi?retryWrites=true&w=majority&connectTimeoutMS=30000&socketTimeoutMS=30000';
  
  await mongoose.connect(CLOUD_ATLAS_URI);
  
  console.log('\n=== CHECKING CLOUD ATLAS DATABASE ===\n');
  
  // Find Shane and Apple
  const shane = await User.findOne({ username: /shane/i });
  const apple = await User.findOne({ username: /apple/i });
  
  if (shane) {
    console.log(`\n📍 SHANE (${shane.name}) - User ID: ${shane._id}`);
    console.log(`   Base Salary: ₱${shane.baseSalary || 0}`);
    
    const shanePayrolls = await Payroll.find({ user: shane._id }).sort({ date: 1 });
    console.log(`   Total payroll records: ${shanePayrolls.length}\n`);
    
    shanePayrolls.forEach((p, i) => {
      console.log(`   ${i+1}. ${new Date(p.date || p.createdAt).toLocaleDateString()}`);
      console.log(`      Base: ₱${p.baseSalary || 0} | Over: ₱${p.over || 0} | Short: ₱${p.short || 0}`);
      console.log(`      Deduction: ₱${p.deduction || 0} | Withdrawal: ₱${p.withdrawal || 0}`);
      console.log(`      Total: ₱${p.totalSalary || 0}`);
      console.log();
    });
  } else {
    console.log('❌ Shane not found in Cloud Atlas');
  }
  
  if (apple) {
    console.log(`\n📍 APPLE (${apple.name}) - User ID: ${apple._id}`);
    console.log(`   Base Salary: ₱${apple.baseSalary || 0}`);
    
    const applePayrolls = await Payroll.find({ user: apple._id }).sort({ date: 1 });
    console.log(`   Total payroll records: ${applePayrolls.length}\n`);
    
    applePayrolls.forEach((p, i) => {
      console.log(`   ${i+1}. ${new Date(p.date || p.createdAt).toLocaleDateString()}`);
      console.log(`      Base: ₱${p.baseSalary || 0} | Over: ₱${p.over || 0} | Short: ₱${p.short || 0}`);
      console.log(`      Deduction: ₱${p.deduction || 0} | Withdrawal: ₱${p.withdrawal || 0}`);
      console.log(`      Total: ₱${p.totalSalary || 0}`);
      console.log();
    });
  } else {
    console.log('❌ Apple not found in Cloud Atlas');
  }
  
  process.exit(0);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
