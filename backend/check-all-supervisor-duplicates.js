import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function checkAllSupervisorDuplicates() {
  try {
    await mongoose.connect(MONGO_URI);

    // Find all supervisors
    const supervisors = await User.find({
      role: { $in: ['supervisor', 'supervisor_teller'] }
    }).select('_id name username role').lean();

    console.log(`Found ${supervisors.length} supervisors`);

    let totalDuplicatesFound = 0;
    let supervisorsWithDuplicates = 0;

    for (const sup of supervisors) {
      // Check for duplicate payrolls by date
      const payrolls = await Payroll.find({ user: sup._id }).lean();

      // Group by date
      const byDate = {};
      payrolls.forEach(p => {
        const dateKey = p.date || p.createdAt?.toISOString().split('T')[0];
        if (!byDate[dateKey]) {
          byDate[dateKey] = [];
        }
        byDate[dateKey].push(p);
      });

      let supervisorDuplicates = 0;
      for (const [date, datePayrolls] of Object.entries(byDate)) {
        if (datePayrolls.length > 1) {
          if (supervisorDuplicates === 0) {
            console.log(`\nSupervisor ${sup.name || sup.username} has duplicates:`);
            supervisorsWithDuplicates++;
          }
          console.log(`  ${date}: ${datePayrolls.length} payrolls`);
          supervisorDuplicates += datePayrolls.length - 1;
        }
      }

      totalDuplicatesFound += supervisorDuplicates;
    }

    console.log(`\nSummary:`);
    console.log(`- Supervisors with duplicates: ${supervisorsWithDuplicates}`);
    console.log(`- Total duplicate payrolls: ${totalDuplicatesFound}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkAllSupervisorDuplicates();