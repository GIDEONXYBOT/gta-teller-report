import mongoose from 'mongoose';

async function checkAppleReports() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_system');
    console.log('Connected to MongoDB');
    
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
    
    // Let's also check for duplicates on specific dates
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
    
    console.log(`\nNov 11 reports: ${nov11Reports.length}`);
    console.log(`Nov 12 reports: ${nov12Reports.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkAppleReports();