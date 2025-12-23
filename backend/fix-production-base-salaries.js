import mongoose from 'mongoose';
import User from './models/User.js';

async function fixBaseSalaries() {
  try {
    // Connect to production database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report');

    const defaultBaseSalaries = {
      teller: 450,
      supervisor: 600,
      supervisor_teller: 600,
      admin: 0,
      super_admin: 0,
      head_watcher: 450,
      sub_watcher: 400,
      declarator: 450,
    };

    console.log('🔧 Fixing base salaries for all users...');

    const users = await User.find({}).select('name username role baseSalary');

    let fixedCount = 0;
    for (const user of users) {
      const correctSalary = defaultBaseSalaries[user.role] || 450;
      if (!user.baseSalary || user.baseSalary === 0 || user.baseSalary !== correctSalary) {
        user.baseSalary = correctSalary;
        await user.save();
        console.log(`✅ Fixed ${user.name || user.username} (${user.role}): ₱${correctSalary}`);
        fixedCount++;
      }
    }

    console.log(`\n🎉 Fixed base salaries for ${fixedCount} users`);

    // Verify all users now have correct base salaries
    const allUsers = await User.find({ role: { $in: ['teller', 'supervisor'] } }).select('name username role baseSalary').lean();
    console.log('\n📊 Verification - Current base salaries:');
    allUsers.forEach(u => {
      console.log(`${u.name || u.username} (${u.role}): ₱${u.baseSalary || 0}`);
    });

    await mongoose.disconnect();
  } catch (e) {
    console.error('❌ Error fixing base salaries:', e.message);
  }
}

fixBaseSalaries();