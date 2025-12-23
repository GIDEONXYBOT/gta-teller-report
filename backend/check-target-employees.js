import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const names = ['charm', 'missy', 'jenessa', 'shane', 'apple'];
    
    console.log('🔍 Checking for target employees:');
    for (const name of names) {
      const user = await User.findOne({ 
        name: { $regex: name, $options: 'i' } 
      });
      if (user) {
        console.log(`✅ ${name}: FOUND - ${user.name} (${user.role}, baseSalary: ₱${user.baseSalary || 0})`);
      } else {
        console.log(`❌ ${name}: NOT FOUND`);
      }
    }

    // Also check all payroll records with zero base salary
    const Payroll = (await import('./models/Payroll.js')).default;
    const zeroPayrolls = await Payroll.find({ baseSalary: { $in: [0, null] } }).limit(20);
    
    console.log(`\n📋 Payroll records with ₱0 base salary (${zeroPayrolls.length} found):`);
    for (const p of zeroPayrolls) {
      console.log(`   - ${p.tellerName || p.name} (Date: ${p.date}): ₱${p.baseSalary || 0}`);
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
