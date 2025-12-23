import mongoose from 'mongoose';

async function checkAppleReports() {
  let connection;
  try {
    // Try different MongoDB connection strings
    const connectionStrings = [
      'mongodb://127.0.0.1:27017/rmi_teller_report',
      'mongodb://localhost:27017/rmi_teller_report',
      'mongodb://127.0.0.1:27017/rmi_teller_system',
      'mongodb://localhost:27017/rmi_teller_system'
    ];
    
    for (const connStr of connectionStrings) {
      try {
        console.log(`Trying to connect to: ${connStr}`);
        await mongoose.connect(connStr, { 
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 3000
        });
        console.log('Connected to MongoDB successfully!');
        break;
      } catch (err) {
        console.log(`Failed to connect to ${connStr}: ${err.message}`);
        if (connectionStrings.indexOf(connStr) === connectionStrings.length - 1) {
          throw new Error('Could not connect to MongoDB with any connection string');
        }
      }
    }
    
    const TellerReport = mongoose.model('TellerReport', new mongoose.Schema({}, { strict: false }));
    
    const appleReports = await TellerReport.find({
      supervisorName: 'Apple'
    }).sort({ date: 1 });
    
    console.log('\n=== APPLE SUPERVISOR REPORTS ===');
    appleReports.forEach(report => {
      console.log(`Date: ${report.date.toISOString().split('T')[0]}`);
      console.log(`ID: ${report._id}`);
      console.log(`Tellers: ${report.tellerDetails ? report.tellerDetails.map(t => t.tellerName).join(', ') : 'No tellers'}`);
      console.log('---');
    });
    
    console.log(`\nTotal Apple reports: ${appleReports.length}`);
    
    // Check for duplicates on November 11 and 12
    const nov11Reports = await TellerReport.find({
      supervisorName: 'Apple',
      date: { 
        $gte: new Date('2024-11-11T00:00:00.000Z'),
        $lt: new Date('2024-11-12T00:00:00.000Z')
      }
    });
    
    const nov12Reports = await TellerReport.find({
      supervisorName: 'Apple',
      date: { 
        $gte: new Date('2024-11-12T00:00:00.000Z'),
        $lt: new Date('2024-11-13T00:00:00.000Z')
      }
    });
    
    console.log(`\n📅 November 11, 2024 reports: ${nov11Reports.length}`);
    nov11Reports.forEach(report => {
      console.log(`  - ${report._id} | Tellers: ${report.tellerDetails ? report.tellerDetails.map(t => t.tellerName).join(', ') : 'None'}`);
    });
    
    console.log(`\n📅 November 12, 2024 reports: ${nov12Reports.length}`);
    nov12Reports.forEach(report => {
      console.log(`  - ${report._id} | Tellers: ${report.tellerDetails ? report.tellerDetails.map(t => t.tellerName).join(', ') : 'None'}`);
    });
    
    if (nov12Reports.length > 0) {
      console.log('\n⚠️ ISSUE DETECTED: Apple still has November 12 reports that should have been merged to November 11!');
      return false;
    } else {
      console.log('\n✅ Apple reports look correct - no November 12 duplicates found');
      return true;
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

checkAppleReports().then(result => {
  if (result === false) {
    console.log('\n🔧 Need to re-run the merge script');
    process.exit(1);
  } else if (result === null) {
    console.log('\n❌ Could not check due to connection issues');
    process.exit(2);
  } else {
    console.log('\n✅ All good!');
    process.exit(0);
  }
});