import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import User from './models/User.js';

dotenv.config();

async function createPayrollFromReports() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all teller reports
    const reports = await TellerReport.find().lean();
    console.log(`📋 Found ${reports.length} teller report(s)\n`);

    if (reports.length === 0) {
      console.log('❌ No teller reports found');
      await mongoose.disconnect();
      return;
    }

    // Group reports by user and date
    const groupedByUserDate = {};
    for (const report of reports) {
      const key = `${report.tellerId}-${report.date}`;
      if (!groupedByUserDate[key]) {
        groupedByUserDate[key] = [];
      }
      groupedByUserDate[key].push(report);
    }

    console.log(`📊 Grouped into ${Object.keys(groupedByUserDate).length} payroll(s)\n`);

    let created = 0;
    for (const [key, reportsForDate] of Object.entries(groupedByUserDate)) {
      const [userId, date] = key.split('-');
      
      // Get user info
      const user = await User.findById(userId);
      if (!user) {
        console.log(`❌ User not found: ${userId}`);
        continue;
      }

      // Calculate totals
      const totalOver = reportsForDate.reduce((sum, r) => sum + (r.over || 0), 0);
      const totalShort = reportsForDate.reduce((sum, r) => sum + (r.short || 0), 0);
      const daysWorked = reportsForDate.length;
      const baseSalary = daysWorked * (user.baseSalary || 0);

      // Calculate total salary
      const totalSalary = baseSalary + totalOver - totalShort;

      // Create payroll
      const payroll = new Payroll({
        user: userId,
        role: user.role,
        baseSalary,
        over: totalOver,
        short: totalShort,
        deduction: 0,
        withdrawal: 0,
        daysPresent: daysWorked,
        date,
        totalSalary,
      });

      await payroll.save();
      created++;

      console.log(`✅ Created payroll for ${user.name || user.username}`);
      console.log(`   Date: ${date}`);
      console.log(`   Reports: ${daysWorked}`);
      console.log(`   Base: ₱${baseSalary} (₱${user.baseSalary}/day × ${daysWorked} days)`);
      console.log(`   Over: ₱${totalOver}`);
      console.log(`   Short: ₱${totalShort}`);
      console.log(`   Total: ₱${totalSalary}\n`);
    }

    console.log(`✅ Created ${created} payroll(s)`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

createPayrollFromReports();
