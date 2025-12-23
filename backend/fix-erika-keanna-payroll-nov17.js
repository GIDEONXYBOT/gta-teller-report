import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi-teller';
const dateStr = '2025-11-17';

async function updatePayrolls() {
  await mongoose.connect(MONGO_URI);

  // Update Keanna's base salary
  const keanna = await User.findOne({ name: /keanna/i });
  if (keanna) {
    const payroll = await Payroll.findOne({ user: keanna._id, date: dateStr });
    if (payroll) {
      payroll.baseSalary = 450; // Set to correct base, change if needed
      await payroll.save();
      console.log(`✅ Keanna's base salary restored for ${dateStr}`);
    } else {
      console.log('❌ Keanna payroll not found for', dateStr);
    }
  } else {
    console.log('❌ Keanna not found');
  }

  // Update Erika's net pay (totalSalary)
  const erika = await User.findOne({ name: /erika/i });
  if (erika) {
    const payroll = await Payroll.findOne({ user: erika._id, date: dateStr });
    if (payroll) {
      payroll.totalSalary = 1234; // Set to correct net pay, change if needed
      await payroll.save();
      console.log(`✅ Erika's net pay updated for ${dateStr}`);
    } else {
      console.log('❌ Erika payroll not found for', dateStr);
    }
  } else {
    console.log('❌ Erika not found');
  }

  await mongoose.disconnect();
}

updatePayrolls().catch(console.error);
