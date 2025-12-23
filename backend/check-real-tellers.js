import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkTellerData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const TellerReport = mongoose.model('TellerReport', new mongoose.Schema({}, { strict: false }));

    // Get recent reports (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentReports = await TellerReport.find({
      createdAt: { $gte: thirtyDaysAgo }
    }).sort({ createdAt: -1 }).limit(10).lean();

    console.log('Recent teller reports:');
    recentReports.forEach((report, i) => {
      console.log(`${i+1}. ${report.tellerName} (${report.tellerId}) - ${new Date(report.createdAt).toLocaleDateString()} - System: ${report.systemBalance}, Cash: ${report.cashOnHand}, Over: ${report.over}, Short: ${report.short}`);
    });

    // Get unique tellers from recent reports
    const uniqueTellers = await TellerReport.distinct('tellerId', {
      createdAt: { $gte: thirtyDaysAgo }
    });

    console.log(`\nUnique active tellers in last 30 days: ${uniqueTellers.length}`);

    // Get latest report for each teller
    const latestReports = [];
    for (const tellerId of uniqueTellers.slice(0, 5)) { // Just first 5 for sample
      const latest = await TellerReport.findOne({ tellerId })
        .sort({ createdAt: -1 })
        .lean();
      if (latest) {
        latestReports.push(latest);
      }
    }

    console.log('\nLatest report for each teller:');
    latestReports.forEach((report, i) => {
      console.log(`${i+1}. ${report.tellerName} - System: ${report.systemBalance}, Cash: ${report.cashOnHand}, Profit: ${(report.cashOnHand || 0) - (report.systemBalance || 0)}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkTellerData();