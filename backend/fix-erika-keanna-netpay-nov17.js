import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';
const dateStr = '2025-11-17';

async function updatePayrolls() {
  await mongoose.connect(MONGO_URI);

  // Update 006erika's net pay
  const erika = await User.findOne({ username: '006erika' });
  if (erika) {
    const payroll = await Payroll.findOne({ user: erika._id, date: dateStr });
    if (payroll) {
      payroll.totalSalary = 675;
      await payroll.save();
      console.log(`✅ 006erika's net pay set to 675 for ${dateStr}`);
    } else {
      console.log('❌ Payroll not found for 006erika on', dateStr);
    }
  } else {
    console.log('❌ User 006erika not found');
  }

  // Update keanna12345's net pay
  const keanna = await User.findOne({ username: 'keanna12345' });
  if (keanna) {
    const payroll = await Payroll.findOne({ user: keanna._id, date: dateStr });
    if (payroll) {
      payroll.totalSalary = 472;
      await payroll.save();
      console.log(`✅ keanna12345's net pay set to 472 for ${dateStr}`);
    } else {
      console.log('❌ Payroll not found for keanna12345 on', dateStr);
    }
  } else {
    console.log('❌ User keanna12345 not found');
  }

  await mongoose.disconnect();
}

updatePayrolls().catch(console.error);
