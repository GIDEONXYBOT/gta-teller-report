import mongoose from 'mongoose';
import User from './models/User.js';
import Payroll from './models/Payroll.js';

async function checkAllSupervisorPayrolls() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi-teller-report');

    // Find all supervisors
    const supervisors = await User.find({ role: { $in: ['supervisor', 'supervisor_teller'] } }).select('_id name username role').lean();
    console.log('Found supervisors:', supervisors.map(s => ({ id: s._id, name: s.name || s.username, role: s.role })));

    for (const sup of supervisors) {
      const payrolls = await Payroll.find({
        user: sup._id
      }).sort({ createdAt: -1 }).limit(10).lean();

      if (payrolls.length > 0) {
        console.log(`\nSupervisor ${sup.name || sup.username} (${sup.role}) has ${payrolls.length} payroll(s) total (showing last 10):`);
        payrolls.forEach(p => {
          console.log(`  - ID: ${p._id}, Date: ${p.date}, Created: ${p.createdAt}, Base: ${p.baseSalary}, Total: ${p.totalSalary}`);
        });
      } else {
        console.log(`\nSupervisor ${sup.name || sup.username} (${sup.role}) has NO payrolls at all`);
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkAllSupervisorPayrolls();