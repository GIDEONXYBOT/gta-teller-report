import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TellerReport from './models/TellerReport.js';
import Capital from './models/Capital.js';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function rebuildPayrolls() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Delete all existing payrolls from Nov 10-16
    const deleteResult = await Payroll.deleteMany({
      createdAt: { $gte: new Date('2025-11-10'), $lt: new Date('2025-11-17') }
    });
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing payrolls\n`);

    // Get all teller reports from Nov 10-16
    const reports = await TellerReport.find({
      createdAt: { $gte: new Date('2025-11-10'), $lt: new Date('2025-11-17') }
    }).lean().sort({ createdAt: 1 });

    // Get all capital records from Nov 10-16
    const capitals = await Capital.find({
      createdAt: { $gte: new Date('2025-11-10'), $lt: new Date('2025-11-17') }
    }).lean().sort({ createdAt: 1 });

    // Get all users
    const users = await User.find({}).lean();
    const userMap = {};
    users.forEach(u => {
      userMap[u._id.toString()] = u;
    });

    console.log('📊 Building payrolls from source data...\n');

    // Track payrolls by user and date
    const payrollMap = {}; // key: "userId_YYYY-MM-DD"

    // Process teller reports
    for (const report of reports) {
      const userId = report.tellerId?.toString();
      if (!userId) continue;

      const user = userMap[userId];
      if (!user) continue;

      const date = new Date(report.createdAt);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0];
      const key = `${userId}_${dateKey}`;

      if (!payrollMap[key]) {
        payrollMap[key] = {
          user: userId,
          role: user.role,
          baseSalary: user.baseSalary || 0,
          over: 0,
          short: 0,
          deduction: 0,
          withdrawal: 0,
          date: date,
          createdAt: date,
        };
      }

      // Add over/short from report
      payrollMap[key].over += Number(report.over) || 0;
      payrollMap[key].short += Number(report.short) || 0;
    }

    // Process capital records - ensure supervisors have payrolls on days they gave capital
    for (const capital of capitals) {
      const supervisorId = capital.supervisorId?.toString();
      if (!supervisorId) continue;

      const supervisor = userMap[supervisorId];
      if (!supervisor) continue;

      const date = new Date(capital.createdAt);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0];
      const key = `${supervisorId}_${dateKey}`;

      if (!payrollMap[key]) {
        payrollMap[key] = {
          user: supervisorId,
          role: supervisor.role,
          baseSalary: supervisor.baseSalary || 0,
          over: 0,
          short: 0,
          deduction: 0,
          withdrawal: 0,
          date: date,
          createdAt: date,
        };
      }
    }

    // Calculate totals and create payroll records
    const payrollsToCreate = [];
    for (const [key, data] of Object.entries(payrollMap)) {
      // Calculate total salary: base - deduction - withdrawal
      // Short/Over amounts are tracked separately for financial reporting only
      data.totalSalary = data.baseSalary - data.deduction - data.withdrawal;
      payrollsToCreate.push(data);
    }

    // Sort by date
    payrollsToCreate.sort((a, b) => a.date - b.date);

    console.log('💾 Creating payroll records:\n');
    let created = 0;

    for (const payrollData of payrollsToCreate) {
      const user = userMap[payrollData.user];
      const dateStr = payrollData.date.toISOString().split('T')[0];
      
      const payroll = await Payroll.create(payrollData);
      created++;
      
      console.log(`✅ ${dateStr} - ${user.username} (${user.role}): Base=₱${payrollData.baseSalary} Over=₱${payrollData.over} Short=₱${payrollData.short} Total=₱${payrollData.totalSalary}`);
    }

    console.log(`\n🎉 Summary:`);
    console.log(`   🗑️  Deleted: ${deleteResult.deletedCount} old payrolls`);
    console.log(`   ✅ Created: ${created} new payrolls`);
    console.log(`   📊 From: ${reports.length} reports + ${capitals.length} capital records`);

    await mongoose.disconnect();
    console.log('\n✅ Done - Payrolls rebuilt from source data!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

rebuildPayrolls();
