// Fix Honey Remulta's base salary
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payroll from './models/Payroll.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  console.log('Connecting to', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  // Find Honey Remulta
  const user = await User.findOne({ 
    $or: [
      { name: /honey.*remulta/i },
      { username: /honey.*remulta/i }
    ]
  });

  if (!user) {
    console.log('❌ User "Honey Remulta" not found');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found user: ${user.name || user.username}`);
  console.log(`  Role: ${user.role}`);
  console.log(`  Current baseSalary: ₱${user.baseSalary || 0}`);

  // Check if they have a baseSalary set
  if (!user.baseSalary || user.baseSalary === 0) {
    console.log('\n⚠️ User has no base salary set!');
    console.log('Would you like to set a base salary? (This script will set it to ₱450 for tellers)');
    
    // Set default base salary based on role
    let newBaseSalary = 450; // Default for tellers
    if (user.role === 'supervisor') newBaseSalary = 500;
    if (user.role === 'admin' || user.role === 'super_admin') newBaseSalary = 0;
    
    user.baseSalary = newBaseSalary;
    await user.save();
    console.log(`✅ Set baseSalary to ₱${newBaseSalary}`);
  } else {
    console.log(`✅ User already has baseSalary set to ₱${user.baseSalary}`);
  }

  // Now update all their payrolls with zero base salary
  const payrolls = await Payroll.find({ 
    user: user._id,
    $or: [
      { baseSalary: 0 },
      { baseSalary: { $exists: false } }
    ]
  });

  console.log(`\nFound ${payrolls.length} payrolls with zero/missing base salary`);

  for (const payroll of payrolls) {
    const oldTotal = payroll.totalSalary;
    payroll.baseSalary = user.baseSalary || 0;
    
    // Recalculate total salary
    payroll.totalSalary = (payroll.baseSalary || 0) + 
                          (payroll.over || 0) - 
                          (payroll.short || 0) - 
                          (payroll.deduction || 0) - 
                          (payroll.withdrawal || 0);
    
    await payroll.save();
    console.log(`  Updated payroll ${payroll._id}: ₱${oldTotal} → ₱${payroll.totalSalary}`);
  }

  console.log('\n✅ Done!');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
