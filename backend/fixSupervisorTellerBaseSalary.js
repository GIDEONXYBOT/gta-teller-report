// fixSupervisorTellerBaseSalary.js
// Update supervisor_teller users who have reports to use teller base salary
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import SystemSettings from './models/SystemSettings.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  try {
    console.log('Connecting to', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Get teller base salary from system settings
    const settings = await SystemSettings.findOne().lean();
    const tellerBase = settings?.baseSalary?.teller || 450;
    console.log(`Teller base salary: ₱${tellerBase}\n`);

    // Find all supervisor_teller users
    const supervisorTellers = await User.find({ 
      role: 'supervisor_teller' 
    }).lean();

    console.log(`Found ${supervisorTellers.length} supervisor_teller users\n`);

    let usersUpdated = 0;
    let payrollsUpdated = 0;

    for (const user of supervisorTellers) {
      // Check if they have any teller reports
      const reports = await TellerReport.find({
        tellerId: user._id
      }).lean();

      if (reports.length === 0) {
        console.log(`ℹ️  ${user.name || user.username} - No reports, skipping`);
        continue;
      }

      console.log(`\n👤 ${user.name || user.username}`);
      console.log(`   Has ${reports.length} teller reports`);
      console.log(`   Current User.baseSalary: ₱${user.baseSalary || 0}`);

      // Update user base salary to teller base if different
      if (user.baseSalary !== tellerBase) {
        await User.findByIdAndUpdate(user._id, {
          $set: { baseSalary: tellerBase }
        });
        console.log(`   ✅ Updated User.baseSalary to ₱${tellerBase}`);
        usersUpdated++;
      } else {
        console.log(`   ℹ️  User.baseSalary already correct`);
      }

      // Find and update their payrolls
      const payrolls = await Payroll.find({ user: user._id }).lean();
      console.log(`   Found ${payrolls.length} payroll(s)`);

      for (const payroll of payrolls) {
        const daysPresent = Number(payroll.daysPresent || 1);
        const correctBase = tellerBase * daysPresent;
        const currentBase = Number(payroll.baseSalary || 0);

        if (currentBase !== correctBase) {
          // Recalculate total
          const newTotal = correctBase + 
                          (Number(payroll.over) || 0) - 
                          (Number(payroll.short) || 0) - 
                          (Number(payroll.deduction) || 0) - 
                          (Number(payroll.withdrawal) || 0);

          await Payroll.findByIdAndUpdate(payroll._id, {
            $set: {
              baseSalary: correctBase,
              totalSalary: newTotal
            }
          });

          console.log(`   🔧 Payroll ${payroll._id}:`);
          console.log(`      Days: ${daysPresent}`);
          console.log(`      Base: ₱${currentBase} → ₱${correctBase}`);
          console.log(`      Total: ₱${payroll.totalSalary} → ₱${newTotal}`);
          payrollsUpdated++;
        }
      }
    }

    console.log(`\n\n=== SUMMARY ===`);
    console.log(`Supervisor_teller users found: ${supervisorTellers.length}`);
    console.log(`Users updated: ${usersUpdated}`);
    console.log(`Payrolls updated: ${payrollsUpdated}`);
    console.log(`\n✅ Fix complete!`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
