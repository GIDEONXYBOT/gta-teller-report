import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import User from '../models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi-teller-report';

// Supervisor _id to assign (string)
// You can override by passing an id as the first CLI argument or set SUPERVISOR_ID env var.
const SUPERVISOR_ID = process.argv[2] || process.env.SUPERVISOR_ID || '690ec9c92dfa944ee4054180';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Only update tellers that currently have no supervisorId
    const ObjectId = mongoose.Types.ObjectId;
    const res = await User.updateMany(
      { role: 'teller', supervisorId: null },
      { $set: { supervisorId: new ObjectId(SUPERVISOR_ID) } }
    );

    console.log('Update result:', res);

    // Show sample of affected users
  const updated = await User.find({ role: 'teller', supervisorId: new ObjectId(SUPERVISOR_ID) }).select('username name supervisorId').limit(20).lean();
    console.log('Sample updated tellers:', updated);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

run();
