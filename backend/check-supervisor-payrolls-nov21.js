import mongoose from 'mongoose';
import User from './models/User.js';
import Payroll from './models/Payroll.js';

async function checkSupervisorPayrolls() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    // Find all supervisors
    const supervisors = await User.find({ role: 'supervisor' }).select('_id name username role').lean();
    console.log('Found supervisors:', supervisors.length);

    for (const supervisor of supervisors) {
      console.log(`Supervisor: ${supervisor.name || supervisor.username} (${supervisor._id})`);

      // Check payrolls for November 21, 2025
      const payrolls = await Payroll.find({
        user: supervisor._id,
        $or: [
          { date: '2025-11-21' },
          { createdAt: { $gte: new Date('2025-11-21T00:00:00.000Z'), $lt: new Date('2025-11-22T00:00:00.000Z') } }
        ]
      }).sort({ createdAt: -1 }).lean();

      console.log(`  Payrolls for Nov 21: ${payrolls.length}`);
      payrolls.forEach((p, i) => {
        console.log(`    ${i+1}. ID: ${p._id}, Date: ${p.date}, Created: ${p.createdAt}, Total: ${p.totalSalary}`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSupervisorPayrolls();