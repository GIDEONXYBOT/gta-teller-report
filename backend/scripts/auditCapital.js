// Audit Capital collection for base/additional capital issues
import mongoose from 'mongoose';
import Capital from '../models/Capital.js';

const MONGO_URI = 'mongodb://localhost:27017/rmi-teller-report';

async function auditCapital() {
  await mongoose.connect(MONGO_URI);
  const records = await Capital.find({}).lean();

  console.log('--- Capital Records Audit ---');
  records.forEach(r => {
    // Flag records with suspiciously high amounts (possible additional included)
    if (r.note && r.note.toLowerCase().includes('additional')) {
      console.log('⚠️ Possible additional capital in base:', r);
    } else {
      console.log('Base capital:', r);
    }
  });
  await mongoose.disconnect();
}

auditCapital().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
