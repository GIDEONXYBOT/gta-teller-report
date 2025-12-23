import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';
const erikaId = '691009cb5071bdabbddc2c21';
const keannaId = '69169fcd776ed83494f2d187';

async function listPayrolls() {
  await mongoose.connect(MONGO_URI);

  const erikaPayrolls = await Payroll.find({ user: erikaId }).lean();
  console.log('Erika Payrolls:');
  erikaPayrolls.forEach(p => {
    console.log(`ID: ${p._id} | Date: ${p.date} | Total: ${p.totalSalary}`);
  });

  const keannaPayrolls = await Payroll.find({ user: keannaId }).lean();
  console.log('\nKeanna Payrolls:');
  keannaPayrolls.forEach(p => {
    console.log(`ID: ${p._id} | Date: ${p.date} | Total: ${p.totalSalary}`);
  });

  await mongoose.disconnect();
}

listPayrolls().catch(console.error);
