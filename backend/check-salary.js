import mongoose from 'mongoose';
import User from './models/User.js';

const mongoUrl = 'mongodb://localhost:27017/rmi_teller_report';

const names = ['charm', 'missy', 'keanna', 'jenessa', 'shane', 'apple'];

try {
  await mongoose.connect(mongoUrl);
  
  const users = await User.find({
    $or: names.map(name => ({
      $or: [
        { name: new RegExp(name, 'i') },
        { username: new RegExp(name, 'i') }
      ]
    }))
  }).select('_id name username role baseCapital').lean();
  
  console.log('\n📊 Base Salary Status:\n');
  users.forEach(u => {
    const salary = u.baseCapital || 0;
    const status = salary === 0 ? '❌ NO BASE SALARY' : `✅ ₱${salary.toLocaleString()}`;
    console.log(`${u.name || u.username} (${u.role}): ${status}`);
  });
  
  console.log('\n');
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
