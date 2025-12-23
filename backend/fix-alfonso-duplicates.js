import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function fixAlfonsoDuplicatePayrolls() {
  try {
    await mongoose.connect(MONGO_URI);

    // Find Alfonso
    const alfonso = await User.findOne({ username: "Alfonso" }).lean();
    if (!alfonso) {
      console.log("Alfonso not found");
      return;
    }

    console.log(`Found Alfonso: ${alfonso.name} (${alfonso._id})`);

    // Find all payrolls for Alfonso on November 21, 2025
    const nov21Start = new Date('2025-11-21T00:00:00.000Z');
    const nov21End = new Date('2025-11-21T23:59:59.999Z');

    const duplicatePayrolls = await Payroll.find({
      user: alfonso._id,
      createdAt: { $gte: nov21Start, $lte: nov21End }
    }).sort({ createdAt: 1 }).lean();

    console.log(`Found ${duplicatePayrolls.length} payrolls for Alfonso on Nov 21, 2025`);

    if (duplicatePayrolls.length <= 1) {
      console.log("No duplicates to fix");
      await mongoose.disconnect();
      return;
    }

    // Keep the first one, delete the rest
    const payrollsToDelete = duplicatePayrolls.slice(1);

    console.log(`Keeping payroll: ${duplicatePayrolls[0]._id}`);
    console.log(`Deleting ${payrollsToDelete.length} duplicates:`);

    for (const payroll of payrollsToDelete) {
      await Payroll.findByIdAndDelete(payroll._id);
      console.log(`  - Deleted: ${payroll._id}`);
    }

    console.log(`✅ Fixed duplicates: kept 1, deleted ${payrollsToDelete.length}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

fixAlfonsoDuplicatePayrolls();