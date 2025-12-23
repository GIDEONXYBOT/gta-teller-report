import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

async function checkSupervisorPayrolls() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    // Find all supervisors
    const supervisors = await User.find({ role: 'supervisor' }).select('_id name username').lean();
    console.log('Supervisors found:', supervisors.length);

    for (const sup of supervisors) {
      console.log(`Supervisor: ${sup.name || sup.username}`);

      // Find all payrolls for this supervisor
      const payrolls = await Payroll.find({ user: sup._id }).sort({ createdAt: -1 }).lean();
      console.log(`  Payrolls: ${payrolls.length}`);

      payrolls.forEach((p, i) => {
        console.log(`    ${i+1}. Date: ${p.date || 'N/A'}, Created: ${p.createdAt}, Total: ${p.totalSalary}`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSupervisorPayrolls();