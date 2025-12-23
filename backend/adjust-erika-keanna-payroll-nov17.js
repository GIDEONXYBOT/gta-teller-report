import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';
const dateStr = '2025-11-17';
const erikaId = '691009cb5071bdabbddc2c21';
const keannaId = '69169fcd776ed83494f2d187';

async function adjustPayrolls() {
  await mongoose.connect(MONGO_URI);

  // Adjust Erika's payroll
  const erikaPayroll = await Payroll.findOne({ user: erikaId, date: dateStr });
  if (erikaPayroll) {
    erikaPayroll.totalSalary = 675;
    await erikaPayroll.save();
    console.log(`✅ Adjusted Erika's net pay to 675 for ${dateStr}`);
  } else {
    console.log('❌ Payroll not found for Erika on', dateStr);
  }

  // Adjust Keanna's payroll
  const keannaPayroll = await Payroll.findOne({ user: keannaId, date: dateStr });
  if (keannaPayroll) {
    keannaPayroll.totalSalary = 472;
    await keannaPayroll.save();
    console.log(`✅ Adjusted Keanna's net pay to 472 for ${dateStr}`);
  } else {
    console.log('❌ Payroll not found for Keanna on', dateStr);
  }

  await mongoose.disconnect();
}

adjustPayrolls().catch(console.error);
