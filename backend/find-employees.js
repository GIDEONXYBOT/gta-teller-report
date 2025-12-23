import mongoose from 'mongoose';
import User from './models/User.js';

const mongoUrl = 'mongodb://localhost:27017/rmi_teller_report';

try {
  await mongoose.connect(mongoUrl);
  
  // Get all tellers and supervisors
  const allUsers = await User.find({
    role: { $in: ['teller', 'supervisor'] }
  }).select('name username role baseSalary').lean();
  
  console.log('\n📊 ALL TELLERS AND SUPERVISORS WITH THEIR BASE SALARY:\n');
  
  const noBaseSalary = allUsers.filter(u => !u.baseSalary || u.baseSalary === 0);
  const withBaseSalary = allUsers.filter(u => u.baseSalary && u.baseSalary > 0);
  
  console.log(`✅ Users WITH base salary: ${withBaseSalary.length}`);
  console.log(`❌ Users WITHOUT base salary: ${noBaseSalary.length}\n`);
  
  if (noBaseSalary.length > 0) {
    console.log('Still need base salary:');
    noBaseSalary.forEach(u => {
      console.log(`  - ${u.name || u.username} (${u.role}): ₱${u.baseSalary || 0}`);
    });
  }
  
  console.log('\n📊 SEARCH FOR SPECIFIC NAMES:\n');
  const searchNames = ['charm', 'missy', 'keanna', 'jenessa', 'shane', 'apple'];
  
  searchNames.forEach(searchName => {
    const found = allUsers.find(u => {
      const fullName = (u.name || u.username).toLowerCase();
      return fullName.includes(searchName.toLowerCase());
    });
    
    if (found) {
      const salary = found.baseSalary || 0;
      const status = salary === 0 ? '❌' : '✅';
      console.log(`${status} ${searchName}: ${found.name || found.username} (${found.role}) - baseSalary = ₱${salary}`);
    } else {
      console.log(`❌ ${searchName}: NOT FOUND`);
    }
  });
  
  console.log('\n');
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
