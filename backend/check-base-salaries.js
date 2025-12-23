import mongoose from 'mongoose';
import User from './models/User.js';

async function checkBaseSalaries() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');

    const users = await User.find({ role: { $in: ['teller', 'supervisor'] } }).select('name username role baseSalary').lean();

    console.log('Current base salaries:');
    users.forEach(u => {
      console.log(`${u.name || u.username} (${u.role}): ₱${u.baseSalary || 0}`);
    });

    const zeroBaseSalary = users.filter(u => !u.baseSalary || u.baseSalary === 0);
    console.log(`\nUsers with zero base salary: ${zeroBaseSalary.length}`);

    await mongoose.disconnect();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

checkBaseSalaries();