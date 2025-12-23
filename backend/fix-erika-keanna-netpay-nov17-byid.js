import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';
const dateStr = '2025-11-17';

async function updatePayrolls() {
  await mongoose.connect(MONGO_URI);

  // Update Erika's net pay
  const erikaId = '691009cb5071bdabbddc2c21';
  const erikaPayroll = await Payroll.findOne({ user: erikaId, date: dateStr });
  if (erikaPayroll) {
    erikaPayroll.totalSalary = 675;
    await erikaPayroll.save();
    console.log(`✅ Erika's net pay set to 675 for ${dateStr}`);
  } else {
    console.log('❌ Payroll not found for Erika on', dateStr);
  }

  // Update Keanna's net pay
  const keannaId = '69169fcd776ed83494f2d187';
  const keannaPayroll = await Payroll.findOne({ user: keannaId, date: dateStr });
  if (keannaPayroll) {
    keannaPayroll.totalSalary = 472;
    await keannaPayroll.save();
    console.log(`✅ Keanna's net pay set to 472 for ${dateStr}`);
  } else {
    console.log('❌ Payroll not found for Keanna on', dateStr);
  }

  await mongoose.disconnect();
}

updatePayrolls().catch(console.error);
