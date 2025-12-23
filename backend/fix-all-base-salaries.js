import mongoose from 'mongoose';
import User from './models/User.js';
import SystemSettings from './models/SystemSettings.js';

const mongoUrl = 'mongodb://localhost:27017/rmi_teller_report';

try {
  await mongoose.connect(mongoUrl);
  
  // Get admin settings for base salaries
  const settings = await SystemSettings.findOne();
  const salaryConfig = settings?.baseSalary || {
    teller: 450,
    supervisor: 600,
    supervisor_teller: 600,
    admin: 1000,
    super_admin: 1000,
    head_watcher: 500,
    sub_watcher: 400,
    declarator: 600,
    assistantAdmin: 600
  };
  
  console.log('\n💰 ADMIN BASE SALARY CONFIGURATION:\n');
  Object.entries(salaryConfig).forEach(([role, salary]) => {
    console.log(`   ${role}: ₱${salary}`);
  });
  console.log('\n');
  
  // Find all tellers and supervisors with zero or no base salary
  const usersWithoutBaseSalary = await User.find({
    role: { $in: ['teller', 'supervisor'] },
    $or: [
      { baseSalary: { $exists: false } },
      { baseSalary: 0 },
      { baseSalary: null }
    ]
  }).select('_id name username role baseSalary').lean();
  
  console.log(`📊 Found ${usersWithoutBaseSalary.length} users with no base salary\n`);
  console.log('Updating base salary based on admin settings:\n');
  
  let updated = 0;
  for (const user of usersWithoutBaseSalary) {
    const baseSalary = salaryConfig[user.role] || salaryConfig.teller;
    await User.findByIdAndUpdate(user._id, { baseSalary });
    console.log(`✅ ${user.name || user.username} (${user.role}): ₱${baseSalary}`);
    updated++;
  }
  
  console.log(`\n✨ Successfully updated ${updated} users!\n`);
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
