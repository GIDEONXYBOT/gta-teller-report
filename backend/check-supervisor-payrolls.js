import mongoose from 'mongoose';
import SupervisorPayroll from './models/SupervisorPayroll.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkSupervisorPayrolls() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report');

    const supervisors = await User.find({ role: 'supervisor' }).select('_id name username').lean();
    console.log('Found supervisors:', supervisors.length);

    for (const sup of supervisors) {
      const payrolls = await SupervisorPayroll.find({ supervisorId: sup._id }).sort({ createdAt: -1 }).limit(5).lean();
      console.log(`\nSupervisor ${sup.name || sup.username}:`);
      if (payrolls.length === 0) {
        console.log('  No payrolls found');
      } else {
        payrolls.forEach(p => {
          console.log(`  ${p.date || p.createdAt} - Base: ${p.baseSalary}, Total: ${p.totalSalary}`);
        });
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkSupervisorPayrolls();