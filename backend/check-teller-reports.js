import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import TellerReport from './models/TellerReport.js';

await mongoose.connect('mongodb://localhost:27017/rmi_teller_report').then(async () => {
  try {
    const now = DateTime.now().setZone("Asia/Manila");
    const todayStr = now.toFormat("yyyy-MM-dd");
    
    console.log('\n🔍 CHECKING TELLER REPORTS FOR:', todayStr);
    
    // Get all teller reports
    const allReports = await TellerReport.find({}).lean();
    console.log(`📋 Total teller reports in DB: ${allReports.length}`);
    
    if (allReports.length > 0) {
      console.log('\nDates with reports:');
      const dates = {};
      allReports.forEach(r => {
        if (!dates[r.date]) dates[r.date] = 0;
        dates[r.date]++;
      });
      Object.entries(dates).forEach(([date, count]) => {
        console.log(`  - ${date}: ${count} reports`);
      });
    }
    
    // Check today's reports
    const todayReports = await TellerReport.find({
      date: todayStr
    }).lean();
    
    console.log(`\n📋 TELLER REPORTS FOR ${todayStr}: ${todayReports.length}`);
    if (todayReports.length > 0) {
      console.log('\nSample reports:');
      todayReports.slice(0, 3).forEach(r => {
        console.log(`  - Date: ${r.date}, systemBalance: ₱${r.systemBalance}, cashOnHand: ₱${r.cashOnHand}`);
      });
    }
    
    console.log('\n✅ Done\n');
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await mongoose.connection.close();
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
