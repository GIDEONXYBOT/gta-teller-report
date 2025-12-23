// syncPayrollsAccumulated.js
// Recalculate all monthly payrolls with accumulated base salaries (days_worked × daily_base)
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import { DateTime } from 'luxon';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  try {
    console.log('Connecting to', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Get current month range
    const now = DateTime.now().setZone("Asia/Manila");
    const start = new Date(now.year, now.month - 1, 1);
    const end = new Date(now.year, now.month, 0, 23, 59, 59);

    console.log(`Syncing payrolls for ${now.toFormat('MMMM yyyy')}`);
    console.log(`Date range: ${start.toISOString()} to ${end.toISOString()}\n`);

    const users = await User.find({ 
      role: { $in: ["teller", "supervisor", "supervisor_teller"] },
      status: "approved"
    }).lean();

    console.log(`Found ${users.length} approved users\n`);

    let processed = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const u of users) {
      try {
        let totalOver = 0;
        let totalShort = 0;
        let daysWorked = 0;

        // For tellers: count reports and accumulate over/short
        if (u.role === "teller") {
          const reports = await TellerReport.find({
            tellerId: u._id,
            date: { $gte: start, $lte: end },
          }).lean();
          
          totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
          totalShort = reports.reduce((sum, r) => sum + (Number(r.short) || 0), 0);
          daysWorked = reports.length;

          if (daysWorked === 0) {
            console.log(`⚠️  ${u.name || u.username} - No reports this month, skipping`);
            skipped++;
            continue;
          }
        }

        // Calculate accumulated base salary
        const dailyBase = Number(u.baseSalary || 0);
        const accumulatedBase = daysWorked * dailyBase;

        // Find or create monthly payroll (one per user per month)
        let payroll = await Payroll.findOne({ 
          user: u._id, 
          createdAt: { $gte: start, $lte: end } 
        });

        const oldBase = payroll ? payroll.baseSalary : 0;
        const oldTotal = payroll ? payroll.totalSalary : 0;

        if (!payroll) {
          payroll = new Payroll({
            user: u._id,
            role: u.role,
            baseSalary: accumulatedBase,
            over: totalOver,
            short: totalShort,
            deduction: 0,
            withdrawal: 0,
            daysPresent: daysWorked,
          });
          created++;
          console.log(`✅ ${u.name || u.username} - CREATED payroll`);
        } else {
          payroll.over = totalOver;
          payroll.short = totalShort;
          payroll.baseSalary = accumulatedBase;
          payroll.daysPresent = daysWorked;
          if (!payroll.role && u.role) payroll.role = u.role;
          updated++;
          console.log(`🔧 ${u.name || u.username} - UPDATED payroll`);
        }

        // Recalculate total
        payroll.totalSalary = (payroll.baseSalary || 0) +
                              (payroll.over || 0) -
                              (payroll.short || 0) -
                              (payroll.deduction || 0) -
                              (payroll.withdrawal || 0);

        await payroll.save();

        console.log(`   Role: ${u.role}`);
        console.log(`   Days worked: ${daysWorked}`);
        console.log(`   Daily base: ₱${dailyBase}`);
        console.log(`   Base salary: ₱${oldBase} → ₱${accumulatedBase}`);
        console.log(`   Over: ₱${totalOver}, Short: ₱${totalShort}`);
        console.log(`   Total salary: ₱${oldTotal} → ₱${payroll.totalSalary}\n`);

        processed++;

      } catch (e) {
        console.error(`❌ Error processing ${u.name || u.username}:`, e.message);
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total users: ${users.length}`);
    console.log(`Processed: ${processed}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (no reports): ${skipped}`);
    console.log('\n✅ Sync complete!');

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
