import mongoose from 'mongoose';
import User from './models/User.js';

const mongoUrl = 'mongodb://localhost:27017/rmi_teller_report';

try {
  await mongoose.connect(mongoUrl);
  
  // Find keanna and update to 500
  const keanna = await User.findOne({
    $or: [
      { name: /keanna/i },
      { username: /keanna/i }
    ]
  });
  
  if (keanna && keanna.baseSalary !== 500) {
    console.log(`\n🔄 Updating Keanna's base salary from ₱${keanna.baseSalary} to ₱500\n`);
    await User.findByIdAndUpdate(keanna._id, { baseSalary: 500 });
    console.log('✅ Updated successfully!\n');
  } else if (keanna) {
    console.log(`\n✅ Keanna already has base salary of ₱500\n`);
  } else {
    console.log(`\n❌ Keanna not found\n`);
  }
  
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
