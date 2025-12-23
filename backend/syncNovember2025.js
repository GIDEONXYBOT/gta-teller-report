// syncNovember2025.js
// Recalculate payrolls specifically for November 2025 with accumulated base salaries
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

    // November 2024: 2024-11-01 to 2024-11-30
    const start = new Date('2024-11-01T00:00:00.000Z');
    const end = new Date('2024-11-30T23:59:59.999Z');

    console.log(`Syncing payrolls for November 2024`);
    console.log(`Date range: ${start.toISOString()} to ${end.toISOString()}\n`);

    // Find all teller reports in November 2024
    const allReports = await TellerReport.find({
      $or: [
        { date: { $gte: '2024-11-01', $lte: '2024-11-30' } },
        { createdAt: { $gte: start, $lte: end } }
      ]
    }).lean();

    console.log(`Found ${allReports.length} total reports in November 2024\n`);

    // Group reports by teller
    const reportsByTeller = new Map();
    for (const report of allReports) {
      const tellerId = String(report.tellerId || report.userId);
      if (!reportsByTeller.has(tellerId)) {
        reportsByTeller.set(tellerId, []);
      }
      reportsByTeller.get(tellerId).push(report);
    }

    console.log(`Found ${reportsByTeller.size} unique tellers with reports\n`);

    let processed = 0;
    let created = 0;
    let updated = 0;

    for (const [tellerId, reports] of reportsByTeller) {
      try {
        const user = await User.findById(tellerId).lean();
        if (!user) {
          console.log(`⚠️  User ${tellerId} not found, skipping`);
          continue;
        }

        // Calculate totals
        const totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
        const totalShort = reports.reduce((sum, r) => sum + (Number(r.short) || 0), 0);
        const daysWorked = reports.length;
        const dailyBase = Number(user.baseSalary || 0);
        const accumulatedBase = daysWorked * dailyBase;

        // Find existing monthly payroll or create new one
        let payroll = await Payroll.findOne({ 
          user: tellerId,
          $or: [
            { date: { $gte: '2024-11-01', $lte: '2024-11-30' } },
            { createdAt: { $gte: start, $lte: end } }
          ]
        });

        const oldBase = payroll ? payroll.baseSalary : 0;
        const oldTotal = payroll ? payroll.totalSalary : 0;

        if (!payroll) {
          // Create new monthly aggregate payroll
          payroll = new Payroll({
            user: tellerId,
            role: user.role,
            baseSalary: accumulatedBase,
            over: totalOver,
            short: totalShort,
            deduction: 0,
            withdrawal: 0,
            daysPresent: daysWorked,
            date: '2024-11-01', // Month start
          });
          created++;
          console.log(`✅ ${user.name || user.username} - CREATED monthly payroll`);
        } else {
          // Update existing payroll
          payroll.over = totalOver;
          payroll.short = totalShort;
          payroll.baseSalary = accumulatedBase;
          payroll.daysPresent = daysWorked;
          if (!payroll.role && user.role) payroll.role = user.role;
          updated++;
          console.log(`🔧 ${user.name || user.username} - UPDATED monthly payroll`);
        }

        // Recalculate total
        payroll.totalSalary = (payroll.baseSalary || 0) +
                              (payroll.over || 0) -
                              (payroll.short || 0) -
                              (payroll.deduction || 0) -
                              (payroll.withdrawal || 0);

        await payroll.save();

        console.log(`   Role: ${user.role}`);
        console.log(`   Days worked: ${daysWorked}`);
        console.log(`   Daily base: ₱${dailyBase}`);
        console.log(`   Base salary: ₱${oldBase} → ₱${accumulatedBase}`);
        console.log(`   Over: ₱${totalOver}, Short: ₱${totalShort}`);
        console.log(`   Total salary: ₱${oldTotal} → ₱${payroll.totalSalary}\n`);

        processed++;

      } catch (e) {
        console.error(`❌ Error processing teller ${tellerId}:`, e.message);
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total tellers with reports: ${reportsByTeller.size}`);
    console.log(`Processed: ${processed}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
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
