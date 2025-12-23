import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function fixAllSupervisorDuplicates() {
  try {
    await mongoose.connect(MONGO_URI);

    // Find all supervisors
    const supervisors = await User.find({
      role: { $in: ['supervisor', 'supervisor_teller'] }
    }).select('_id name username role').lean();

    console.log(`Found ${supervisors.length} supervisors`);

    let totalDeleted = 0;

    for (const sup of supervisors) {
      // Get all payrolls for this supervisor
      const payrolls = await Payroll.find({ user: sup._id }).sort({ createdAt: 1 }).lean();

      // Group by date
      const byDate = {};
      payrolls.forEach(p => {
        const dateKey = p.date || p.createdAt?.toISOString().split('T')[0];
        if (!byDate[dateKey]) {
          byDate[dateKey] = [];
        }
        byDate[dateKey].push(p);
      });

      for (const [date, datePayrolls] of Object.entries(byDate)) {
        if (datePayrolls.length > 1) {
          console.log(`\nSupervisor ${sup.name || sup.username} - ${date}: ${datePayrolls.length} payrolls`);

          // Keep the first one, delete the rest
          const toDelete = datePayrolls.slice(1);
          for (const payroll of toDelete) {
            await Payroll.findByIdAndDelete(payroll._id);
            console.log(`  - Deleted: ${payroll._id}`);
            totalDeleted++;
          }
        }
      }
    }

    console.log(`\n✅ Total duplicates removed: ${totalDeleted}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

fixAllSupervisorDuplicates();