import mongoose from 'mongoose';
import User from './models/User.js';
import Payroll from './models/Payroll.js';

async function checkSupervisorPayrolls() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi-teller-report');

    // Find all supervisors
    const supervisors = await User.find({ role: { $in: ['supervisor', 'supervisor_teller'] } }).select('_id name username role').lean();
    console.log('Found supervisors:', supervisors.map(s => ({ id: s._id, name: s.name || s.username, role: s.role })));

    // Check payrolls for Nov 21
    const nov21Start = new Date('2024-11-21T00:00:00.000Z');
    const nov21End = new Date('2024-11-21T23:59:59.999Z');

    for (const sup of supervisors) {
      const payrolls = await Payroll.find({
        user: sup._id,
        $or: [
          { createdAt: { $gte: nov21Start, $lte: nov21End } },
          { date: '2024-11-21' }
        ]
      }).lean();

      if (payrolls.length > 0) {
        console.log(`Supervisor ${sup.name || sup.username} (${sup.role}) has ${payrolls.length} payroll(s) for Nov 21:`);
        payrolls.forEach(p => {
          console.log(`  - ID: ${p._id}, Date: ${p.date}, Created: ${p.createdAt}, Base: ${p.baseSalary}, Total: ${p.totalSalary}`);
        });
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkSupervisorPayrolls();