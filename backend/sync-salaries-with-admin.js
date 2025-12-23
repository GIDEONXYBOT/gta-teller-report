import mongoose from 'mongoose';
import User from './models/User.js';
import SystemSettings from './models/SystemSettings.js';

const mongoUrl = 'mongodb://localhost:27017/rmi_teller_report';

try {
  await mongoose.connect(mongoUrl);
  
  // Get admin settings
  const settings = await SystemSettings.findOne();
  const salaryConfig = settings?.baseSalary || {
    teller: 450,
    supervisor: 600
  };
  
  console.log('\n🔧 FIXING MISMATCHED BASE SALARIES:\n');
  console.log(`📋 Admin settings: Teller = ₱${salaryConfig.teller}, Supervisor = ₱${salaryConfig.supervisor}\n`);
  
  // Find all users whose salary doesn't match admin settings
  const allUsers = await User.find({
    role: { $in: ['teller', 'supervisor'] }
  }).select('_id name username role baseSalary').lean();
  
  let updated = 0;
  for (const user of allUsers) {
    const expectedSalary = salaryConfig[user.role];
    
    if (expectedSalary && user.baseSalary !== expectedSalary) {
      await User.findByIdAndUpdate(user._id, { baseSalary: expectedSalary });
      console.log(`✅ ${user.name || user.username} (${user.role}): ₱${user.baseSalary} → ₱${expectedSalary}`);
      updated++;
    }
  }
  
  if (updated === 0) {
    console.log('✅ All base salaries match admin settings!\n');
  } else {
    console.log(`\n✨ Fixed ${updated} users!\n`);
  }
  
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
