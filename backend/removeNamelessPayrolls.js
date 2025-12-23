// removeNamelessPayrolls.js
// Delete payrolls that have no linked user or the user has neither name nor username
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js'; // ensure model is registered for populate

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

function isBlank(str) {
  return !str || (typeof str === 'string' && str.trim() === '');
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  try {
    console.log('Connecting to', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Populate minimal user identity to evaluate
    const payrolls = await Payroll.find({}).populate('user', 'name username role').lean();

    const toDelete = [];
    for (const p of payrolls) {
      const u = p.user;
      if (!u) {
        toDelete.push({ id: p._id, reason: 'no-user-ref' });
        continue;
      }
      const noName = isBlank(u.name);
      const noUsername = isBlank(u.username);
      if (noName && noUsername) {
        toDelete.push({ id: p._id, reason: 'blank-identity' });
      }
    }

    if (toDelete.length === 0) {
      console.log('✅ No nameless/orphaned payrolls found.');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`Found ${toDelete.length} payroll(s) to remove:\n`);
    toDelete.slice(0, 50).forEach((d, idx) => {
      console.log(`${idx + 1}. ${d.id} - ${d.reason}`);
    });
    if (toDelete.length > 50) console.log(`...and ${toDelete.length - 50} more`);

    if (dryRun) {
      console.log('\nDry run only. No deletions performed.');
      await mongoose.disconnect();
      process.exit(0);
    }

    const ids = toDelete.map((d) => d.id);
    const res = await Payroll.deleteMany({ _id: { $in: ids } });
    console.log(`\n🗑️  Deleted ${res.deletedCount || 0} payroll(s).`);

    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
