import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';

async function checkPayrollRaw() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi-teller-report');

    const payrolls = await Payroll.find({}).lean();

    console.log(`Found ${payrolls.length} raw payroll records:`);
    payrolls.forEach(p => {
      console.log(`  - ID: ${p._id}`);
      console.log(`    User ID: ${p.user}`);
      console.log(`    Role: ${p.role}`);
      console.log(`    Date: ${p.date}`);
      console.log(`    Created: ${p.createdAt}`);
      console.log(`    Base: ₱${p.baseSalary}, Total: ₱${p.totalSalary}`);
      console.log('');
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkPayrollRaw();