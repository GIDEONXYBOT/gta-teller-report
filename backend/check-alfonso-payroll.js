import mongoose from 'mongoose';
import User from './models/User.js';
import Payroll from './models/Payroll.js';
import SupervisorPayroll from './models/SupervisorPayroll.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function checkAlfonsoPayroll() {
  try {
    await mongoose.connect(MONGO_URI);

    // Find Alfonso by username
    const alfonso = await User.findOne({ username: "Alfonso" }).lean();

    if (!alfonso) {
      console.log('Alfonso not found in users');
      await mongoose.disconnect();
      return;
    }

    console.log('Found Alfonso:', {
      id: alfonso._id,
      name: alfonso.name,
      username: alfonso.username,
      role: alfonso.role
    });

    // Check yesterday's date (November 21, 2025)
    const yesterday = new Date('2025-11-21');
    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    console.log(`\nChecking payrolls for November 21, 2025 (${yesterdayStart.toISOString()} to ${yesterdayEnd.toISOString()})`);

    // Check regular Payroll collection
    const regularPayrolls = await Payroll.find({
      user: alfonso._id,
      $or: [
        { createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } },
        { date: '2025-11-21' }
      ]
    }).lean();

    console.log(`\nRegular Payroll records for Alfonso on Nov 21: ${regularPayrolls.length}`);
    regularPayrolls.forEach((p, i) => {
      console.log(`${i+1}. ID: ${p._id}`);
      console.log(`   Date: ${p.date}`);
      console.log(`   Created: ${p.createdAt}`);
      console.log(`   Base: ₱${p.baseSalary}, Total: ₱${p.totalSalary}`);
      console.log(`   Role: ${p.role}`);
      console.log('');
    });

    // Check SupervisorPayroll if Alfonso is a supervisor
    if (alfonso.role === 'supervisor' || alfonso.role === 'supervisor_teller') {
      const supervisorPayrolls = await SupervisorPayroll.find({
        supervisorId: alfonso._id
      }).lean();

      console.log(`SupervisorPayroll records for Alfonso: ${supervisorPayrolls.length}`);
      supervisorPayrolls.forEach((p, i) => {
        console.log(`${i+1}. ID: ${p._id}`);
        console.log(`   Created: ${p.createdAt}`);
        console.log(`   Base: ₱${p.baseSalary}, Total: ₱${p.totalSalary}`);
        console.log(`   Days Present: ${p.daysPresent}`);
        console.log('');
      });
    }

    // Check all payrolls for Alfonso (not just yesterday)
    const allRegularPayrolls = await Payroll.find({ user: alfonso._id }).sort({ createdAt: -1 }).limit(10).lean();
    console.log(`\nAll recent regular payrolls for Alfonso (${allRegularPayrolls.length} total, showing last 10):`);
    allRegularPayrolls.forEach((p, i) => {
      console.log(`${i+1}. ${p.date || p.createdAt} - Base: ₱${p.baseSalary}, Total: ₱${p.totalSalary}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkAlfonsoPayroll();