import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';
const dateStr = '2025-11-17';
const erikaId = '691009cb5071bdabbddc2c21';
const keannaId = '69169fcd776ed83494f2d187';

async function createPayrolls() {
  await mongoose.connect(MONGO_URI);

  // Create Erika's payroll
  let erikaPayroll = await Payroll.findOne({ user: erikaId, date: dateStr });
  if (!erikaPayroll) {
    erikaPayroll = new Payroll({
      user: erikaId,
      date: dateStr,
      totalSalary: 675,
      role: 'teller',
      // Add other required fields if needed
    });
    await erikaPayroll.save();
    console.log(`✅ Created payroll for Erika on ${dateStr} with net pay 675`);
  } else {
    console.log('ℹ️ Payroll for Erika already exists on', dateStr);
  }

  // Create Keanna's payroll
  let keannaPayroll = await Payroll.findOne({ user: keannaId, date: dateStr });
  if (!keannaPayroll) {
    keannaPayroll = new Payroll({
      user: keannaId,
      date: dateStr,
      totalSalary: 472,
      role: 'teller',
      // Add other required fields if needed
    });
    await keannaPayroll.save();
    console.log(`✅ Created payroll for Keanna on ${dateStr} with net pay 472`);
  } else {
    console.log('ℹ️ Payroll for Keanna already exists on', dateStr);
  }

  await mongoose.disconnect();
}

createPayrolls().catch(console.error);
