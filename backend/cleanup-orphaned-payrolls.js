import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import User from './models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function cleanupOrphanedPayrolls() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all payrolls with over/short
    const payrolls = await Payroll.find({
      $or: [
        { over: { $gt: 0 } },
        { short: { $gt: 0 } }
      ]
    }).populate('user', 'username name role baseSalary');

    console.log(`🔍 Found ${payrolls.length} payrolls with over/short amounts\n`);

    let deletedCount = 0;
    let keptCount = 0;

    for (const payroll of payrolls) {
      const user = payroll.user;
      if (!user) {
        console.log(`⚠️  Skipping payroll ${payroll._id} - no user reference`);
        continue;
      }

      // Get the date from payroll
      const payrollDate = payroll.date || new Date(payroll.createdAt).toISOString().split('T')[0];
      
      // Check if there are any teller reports for this user on this date
      const reports = await TellerReport.find({
        user: user._id,
        date: payrollDate
      });

      if (reports.length === 0) {
        // No reports found - this payroll is orphaned
        console.log(`❌ ORPHANED: ${user.name || user.username} (${payrollDate})`);
        console.log(`   Payroll ID: ${payroll._id}`);
        console.log(`   Over: ₱${payroll.over}, Short: ₱${payroll.short}, Total: ₱${payroll.totalSalary}`);
        console.log(`   Action: DELETING\n`);
        
        await Payroll.deleteOne({ _id: payroll._id });
        deletedCount++;
      } else {
        console.log(`✅ VALID: ${user.name || user.username} (${payrollDate})`);
        console.log(`   Reports found: ${reports.length}`);
        console.log(`   Over: ₱${payroll.over}, Short: ₱${payroll.short}, Total: ₱${payroll.totalSalary}\n`);
        keptCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Valid payrolls kept: ${keptCount}`);
    console.log(`   ❌ Orphaned payrolls deleted: ${deletedCount}`);

    await mongoose.disconnect();
    console.log('\n✅ Cleanup complete');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

cleanupOrphanedPayrolls();
