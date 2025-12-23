import mongoose from 'mongoose';
import SupervisorPayroll from './models/SupervisorPayroll.js';
import User from './models/User.js';

async function checkAllSupervisorPayrolls() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');

    const supervisorPayrolls = await SupervisorPayroll.find({})
      .populate('supervisorId', 'name username role')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${supervisorPayrolls.length} SupervisorPayroll records:`);
    supervisorPayrolls.forEach(p => {
      console.log(`  - Supervisor: ${p.supervisorId?.name || p.supervisorId?.username || 'Unknown'}`);
      console.log(`    ID: ${p._id}`);
      console.log(`    Base: ₱${p.baseSalary}, Total: ₱${p.totalSalary}`);
      console.log(`    Created: ${p.createdAt}`);
      console.log('');
    });

    // Check for duplicates
    const bySupervisor = {};
    supervisorPayrolls.forEach(p => {
      const supId = p.supervisorId?._id?.toString() || 'unknown';
      if (!bySupervisor[supId]) {
        bySupervisor[supId] = [];
      }
      bySupervisor[supId].push(p);
    });

    console.log('Checking for duplicates:');
    let hasDuplicates = false;
    for (const [supId, payrolls] of Object.entries(bySupervisor)) {
      if (payrolls.length > 1) {
        console.log(`Supervisor ${supId} has ${payrolls.length} payroll records!`);
        hasDuplicates = true;
      }
    }

    if (!hasDuplicates) {
      console.log('No duplicate SupervisorPayroll records found.');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkAllSupervisorPayrolls();