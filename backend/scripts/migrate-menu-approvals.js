#!/usr/bin/env node
// One-off migration: replace legacy 'approvals' menu id with canonical 'user-approval'
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MenuPermission from '../models/MenuPermission.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function migrate() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB for menu migration');

  const docs = await MenuPermission.find({ menuItems: 'approvals' }).lean();
  if (!docs.length) {
    console.log('No MenuPermission docs found with legacy approvals id. Nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${docs.length} documents to normalize.`);

  for (const d of docs) {
    try {
      const original = d.menuItems || [];
      const mapped = original.map(id => id === 'approvals' ? 'user-approval' : id);
      const deduped = Array.from(new Set(mapped));
      await MenuPermission.findByIdAndUpdate(d._id, { menuItems: deduped });
      console.log(`Updated role='${d.role}' -> [${deduped.join(', ')}]`);
    } catch (err) {
      console.error('Failed to update', d._id, d.role, err.message);
    }
  }

  console.log('Migration complete — disconnecting');
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
