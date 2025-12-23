import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TellerReport from './models/TellerReport.js';
import User from './models/User.js';

dotenv.config();

async function showAllReports() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const startDate = new Date('2025-11-10T00:00:00Z');
    const endDate = new Date('2025-11-17T00:00:00Z');

    const reports = await TellerReport.find({
      createdAt: { $gte: startDate, $lt: endDate }
    }).populate('tellerId', 'username name').sort({ createdAt: 1 }).lean();

    console.log(`📊 ALL TELLER REPORTS (Nov 10-16, 2025)\n`);
    console.log(`Total Reports: ${reports.length}\n`);
    console.log('='.repeat(100));

    const groupedByTeller = {};
    
    reports.forEach(report => {
      const tellerName = report.tellerId?.username || report.tellerId?.name || 'Unknown';
      if (!groupedByTeller[tellerName]) {
        groupedByTeller[tellerName] = [];
      }
      groupedByTeller[tellerName].push(report);
    });

    for (const [tellerName, tellerReports] of Object.entries(groupedByTeller).sort()) {
      console.log(`\n👤 ${tellerName.toUpperCase()}`);
      tellerReports.forEach((report, index) => {
        const date = new Date(report.createdAt).toISOString().split('T')[0];
        const over = report.over || 0;
        const short = report.short || 0;
        const netOver = over - short;
        console.log(`   ${index + 1}. ${date}: Over=₱${over}, Short=₱${short}, Net=₱${netOver}`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

showAllReports();
