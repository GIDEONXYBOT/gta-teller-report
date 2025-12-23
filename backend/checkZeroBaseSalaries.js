// checkZeroBaseSalaries.js
// Find payrolls with baseSalary = 0 and check if their user has a baseSalary set
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  console.log('Connecting to', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // Find all payrolls with baseSalary = 0
  const payrolls = await Payroll.find({ baseSalary: 0 }).populate('user').lean();
  
  console.log(`Found ${payrolls.length} payrolls with baseSalary = 0\n`);

  for (const p of payrolls) {
    const user = p.user;
    if (!user) {
      console.log(`❌ Payroll ${p._id} has no user reference`);
      continue;
    }

    console.log(`User: ${user.name || user.username} (${user.role})`);
    console.log(`  User.baseSalary: ${user.baseSalary || 0}`);
    console.log(`  Payroll.baseSalary: ${p.baseSalary}`);
    console.log(`  Payroll.totalSalary: ${p.totalSalary}`);
    console.log(`  Payroll date: ${p.date || 'N/A'}, createdAt: ${p.createdAt}`);
    
    if (user.baseSalary && Number(user.baseSalary) > 0) {
      console.log(`  ⚠️ User has baseSalary=${user.baseSalary} but payroll has 0! Should update.\n`);
    } else {
      console.log(`  ℹ️ User also has no baseSalary set.\n`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
