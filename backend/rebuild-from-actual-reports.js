import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import Capital from './models/Capital.js';
import User from './models/User.js';

dotenv.config();

async function rebuildFromReports() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const startDate = new Date('2025-11-10T00:00:00Z');
    const endDate = new Date('2025-11-17T00:00:00Z');

    console.log('🗑️  Deleting existing payrolls (Nov 10-16)...');
    const deleted = await Payroll.deleteMany({
      createdAt: { $gte: startDate, $lt: endDate }
    });
    console.log(`   Deleted ${deleted.deletedCount} payrolls\n`);

    // Get all reports
    const reports = await TellerReport.find({
      createdAt: { $gte: startDate, $lt: endDate }
    }).populate('tellerId', 'username name baseSalary').sort({ createdAt: 1 }).lean();

    console.log(`📊 Found ${reports.length} teller reports\n`);
    console.log('='.repeat(80));

    const payrollsToCreate = [];
    const processedReports = new Set();

    // Process each report
    for (const report of reports) {
      if (!report.tellerId) {
        console.log(`⚠️  Skipping report with no teller ID`);
        continue;
      }

      const reportDate = new Date(report.createdAt);
      const dateKey = reportDate.toISOString().split('T')[0];
      const uniqueKey = `${report.tellerId._id}_${dateKey}`;

      // Skip if already processed (duplicate reports same day)
      if (processedReports.has(uniqueKey)) {
        console.log(`⚠️  Duplicate report for ${report.tellerId.username} on ${dateKey} - using first`);
        continue;
      }
      processedReports.add(uniqueKey);

      const baseSalary = report.tellerId.baseSalary || 450;
      const over = report.over || 0;
      const short = report.short || 0;
      const totalSalary = baseSalary + over - short;

      const tellerName = report.tellerId.username || report.tellerId.name;
      console.log(`\n✅ ${tellerName} (${dateKey})`);
      console.log(`   Base: ₱${baseSalary}, Over: ₱${over}, Short: ₱${short}, Total: ₱${totalSalary}`);

      payrollsToCreate.push({
        user: report.tellerId._id,
        role: 'teller',
        baseSalary,
        over,
        short,
        deduction: 0,
        withdrawal: 0,
        totalSalary,
        approved: false,
        createdAt: reportDate
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n💾 Creating ${payrollsToCreate.length} payrolls...`);

    if (payrollsToCreate.length > 0) {
      await Payroll.insertMany(payrollsToCreate);
      console.log(`✅ Created ${payrollsToCreate.length} payrolls successfully`);
    }

    // Now check for supervisors with capital records but no payrolls
    console.log('\n📋 Checking supervisors with capital records...\n');
    
    const capitals = await Capital.find({
      createdAt: { $gte: startDate, $lt: endDate }
    }).populate('supervisorId', 'username name baseSalary role').lean();

    const supervisorPayrollsByDate = {};

    for (const capital of capitals) {
      if (!capital.supervisorId) continue;
      
      const supervisor = capital.supervisorId;
      if (supervisor.role !== 'supervisor') continue;

      const capitalDate = new Date(capital.createdAt);
      const dateKey = capitalDate.toISOString().split('T')[0];
      const uniqueKey = `${supervisor._id}_${dateKey}`;

      if (!supervisorPayrollsByDate[uniqueKey]) {
        // Check if payroll already exists
        const existing = await Payroll.findOne({
          user: supervisor._id,
          createdAt: {
            $gte: new Date(dateKey + 'T00:00:00Z'),
            $lt: new Date(new Date(dateKey).setDate(new Date(dateKey).getDate() + 1))
          }
        });

        if (!existing) {
          const baseSalary = supervisor.baseSalary || 450;
          console.log(`✅ Creating supervisor payroll: ${supervisor.username} (${dateKey}) - Base: ₱${baseSalary}`);

          await Payroll.create({
            user: supervisor._id,
            role: 'supervisor',
            baseSalary,
            over: 0,
            short: 0,
            deduction: 0,
            withdrawal: 0,
            totalSalary: baseSalary,
            approved: false,
            createdAt: capitalDate
          });

          supervisorPayrollsByDate[uniqueKey] = true;
        }
      }
    }

    console.log('\n✅ Rebuild complete!');

    // Summary
    const finalCount = await Payroll.countDocuments({
      createdAt: { $gte: startDate, $lt: endDate }
    });
    console.log(`\n📊 Total payrolls in database: ${finalCount}`);

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

rebuildFromReports();
