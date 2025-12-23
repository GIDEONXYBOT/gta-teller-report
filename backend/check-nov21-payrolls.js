import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';

async function checkNov21Payrolls() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    // Check payrolls created on November 21, 2025
    const startDate = new Date('2025-11-21T00:00:00.000Z');
    const endDate = new Date('2025-11-22T00:00:00.000Z');

    const nov21Payrolls = await Payroll.find({
      createdAt: { $gte: startDate, $lt: endDate }
    }).populate('user', 'name username role').lean();

    console.log(`Payrolls created on November 21, 2025: ${nov21Payrolls.length}`);

    nov21Payrolls.forEach((p, i) => {
      const user = p.user || {};
      console.log(`${i+1}. ${user.name || user.username} (${user.role}) - Total: ${p.totalSalary} - ID: ${p._id}`);
    });

    // Check for any payrolls with date field set to Nov 21
    const datePayrolls = await Payroll.find({ date: '2025-11-21' }).populate('user', 'name username role').lean();

    console.log(`\nPayrolls with date field '2025-11-21': ${datePayrolls.length}`);

    datePayrolls.forEach((p, i) => {
      const user = p.user || {};
      console.log(`${i+1}. ${user.name || user.username} (${user.role}) - Total: ${p.totalSalary} - ID: ${p._id}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkNov21Payrolls();