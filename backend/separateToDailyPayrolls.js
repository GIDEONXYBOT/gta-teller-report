// separateToDailyPayrolls.js
// Convert monthly/consolidated payrolls into separate daily payrolls (one per report date)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  try {
    console.log('Connecting to', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Get all payrolls with daysPresent > 1 (consolidated payrolls)
    const consolidatedPayrolls = await Payroll.find({
      daysPresent: { $gt: 1 }
    }).populate('user', 'name username role baseSalary').lean();

    console.log(`Found ${consolidatedPayrolls.length} consolidated payrolls (daysPresent > 1)\n`);

    let deleted = 0;
    let created = 0;

    for (const payroll of consolidatedPayrolls) {
      if (!payroll.user || !payroll.user._id) {
        console.log(`⚠️  Skipping payroll ${payroll._id} - no user reference`);
        continue;
      }

      const user = payroll.user;
      console.log(`\n🔄 ${user.name || user.username}`);
      console.log(`   Consolidated payroll: ${payroll.daysPresent} days`);
      console.log(`   Total base: ₱${payroll.baseSalary}`);
      console.log(`   Total over: ₱${payroll.over}`);
      console.log(`   Total short: ₱${payroll.short}`);

      // Find all teller reports for this user
      const reports = await TellerReport.find({
        tellerId: user._id
      }).sort({ createdAt: 1 }).lean();

      if (reports.length === 0) {
        console.log(`   ⚠️  No reports found, skipping`);
        continue;
      }

      console.log(`   Found ${reports.length} teller reports`);

      // Create a daily payroll for each report
      let dailyPayrollsCreated = 0;
      
      for (const report of reports) {
        const reportDate = report.date || report.createdAt?.toISOString().split('T')[0];
        
        if (!reportDate) {
          console.log(`   ⚠️  Report ${report._id} has no date, skipping`);
          continue;
        }

        // Check if a payroll already exists for this exact date
        const existingDaily = await Payroll.findOne({
          user: user._id,
          date: reportDate,
          _id: { $ne: payroll._id } // Exclude the consolidated payroll we're splitting
        }).lean();

        if (existingDaily) {
          console.log(`   ℹ️  Daily payroll already exists for ${reportDate}, skipping`);
          continue;
        }

        // Create daily payroll
        const dailyBase = Number(user.baseSalary || 0);
        const over = Number(report.over || 0);
        const short = Number(report.short || 0);
        const totalSalary = dailyBase + over - short;

        const dailyPayroll = await Payroll.create({
          user: user._id,
          role: user.role,
          baseSalary: dailyBase,
          over: over,
          short: short,
          deduction: 0,
          withdrawal: 0,
          totalSalary: totalSalary,
          date: reportDate,
          daysPresent: 1,
          createdAt: new Date(reportDate + 'T00:00:00.000Z'),
        });

        console.log(`   ✅ Created daily payroll for ${reportDate}: base=₱${dailyBase} over=₱${over} short=₱${short} total=₱${totalSalary}`);
        dailyPayrollsCreated++;
        created++;
      }

      // Delete the consolidated payroll
      if (dailyPayrollsCreated > 0) {
        await Payroll.findByIdAndDelete(payroll._id);
        console.log(`   🗑️  Deleted consolidated payroll ${payroll._id}`);
        deleted++;
      }
    }

    console.log(`\n\n=== SUMMARY ===`);
    console.log(`Consolidated payrolls processed: ${consolidatedPayrolls.length}`);
    console.log(`Consolidated payrolls deleted: ${deleted}`);
    console.log(`Daily payrolls created: ${created}`);
    console.log(`\n✅ Separation complete!`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
