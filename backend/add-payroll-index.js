import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function addPayrollIndex() {
  try {
    await mongoose.connect(MONGO_URI);

    // Add a unique index on user + date to prevent future duplicates
    // Note: This will only work if there are no existing duplicates
    try {
      await Payroll.collection.createIndex(
        { user: 1, date: 1 },
        {
          unique: true,
          partialFilterExpression: { date: { $exists: true } }
        }
      );
      console.log('✅ Added unique index on user + date for Payroll collection');
    } catch (indexError) {
      console.log('⚠️ Could not create unique index (duplicates may still exist):', indexError.message);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

addPayrollIndex();