// runEnsureBaseNow.js
// Run this manually to trigger ensureBaseSalaryForActiveUsers once (for testing)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ensureBaseSalaryForActiveUsers } from './utils/ensureBaseSalary.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  try {
    console.log('Connecting to', MONGO_URI);
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    await ensureBaseSalaryForActiveUsers();

    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error running ensureBaseSalaryForActiveUsers:', err);
    process.exit(1);
  }
}

run();
