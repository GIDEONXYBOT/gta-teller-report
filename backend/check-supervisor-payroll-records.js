import mongoose from 'mongoose';
import SupervisorPayroll from './models/SupervisorPayroll.js';
import User from './models/User.js';

async function checkSupervisorPayrolls() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');

    // Find all supervisors
    const supervisors = await User.find({ role: { $in: ['supervisor', 'supervisor_teller'] } }).select('_id name username role').lean();
    console.log('Found supervisors:', supervisors.map(s => ({ id: s._id, name: s.name || s.username, role: s.role })));

    for (const sup of supervisors) {
      const payroll = await SupervisorPayroll.findOne({ supervisorId: sup._id }).lean();

      if (payroll) {
        console.log(`\nSupervisor ${sup.name || sup.username} (${sup.role}) has SupervisorPayroll:`);
        console.log(`  - ID: ${payroll._id}`);
        console.log(`  - Base Salary: ₱${payroll.baseSalary}`);
        console.log(`  - Total Salary: ₱${payroll.totalSalary}`);
        console.log(`  - Over: ₱${payroll.over}`);
        console.log(`  - Short: ₱${payroll.short}`);
        console.log(`  - Days Present: ${payroll.daysPresent}`);
        console.log(`  - Created: ${payroll.createdAt}`);
        console.log(`  - Updated: ${payroll.updatedAt}`);
      } else {
        console.log(`\nSupervisor ${sup.name || sup.username} (${sup.role}) has NO SupervisorPayroll record`);
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkSupervisorPayrolls();