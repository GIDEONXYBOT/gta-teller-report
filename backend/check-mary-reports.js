import TellerReport from './models/TellerReport.js';
import User from './models/User.js';
import mongoose from 'mongoose';

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rmi-teller-report')
  .then(async () => {
    console.log('=== CHECKING MARY GOLD TELLER REPORTS ===');
    
    const user = await User.findOne({ username: 'mlaburada29' });
    if (!user) {
      console.log('❌ Mary Gold user not found');
      process.exit(1);
    }
    
    console.log(`👤 Mary Gold User ID: ${user._id}`);
    console.log(`📧 Username: ${user.username}`);
    console.log(`👤 Name: ${user.name}`);
    
    const reports = await TellerReport.find({ tellerId: user._id }).sort({ createdAt: -1 });
    console.log(`📊 Total Reports Found: ${reports.length}`);
    
    if (reports.length > 0) {
      console.log('\n=== LATEST REPORTS ===');
      reports.slice(0, 5).forEach((report, index) => {
        console.log(`${index + 1}. Date: ${report.createdAt}`);
        console.log(`   System Balance: ₱${report.systemBalance}`);
        console.log(`   Cash on Hand: ₱${report.cashOnHand}`);
        console.log(`   Short: ₱${report.short}`);
        console.log(`   Over: ₱${report.over}`);
        console.log(`   Verified: ${report.isVerified || false}`);
        console.log(`   Approved: ${report.isApproved || false}`);
        console.log('   ---');
      });
      
      // Check today's report
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayReport = await TellerReport.findOne({ 
        tellerId: user._id, 
        createdAt: { $gte: today, $lt: tomorrow }
      });
      
      if (todayReport) {
        console.log('\n=== TODAY\'S REPORT ===');
        console.log(`System Balance: ₱${todayReport.systemBalance}`);
        console.log(`Cash on Hand: ₱${todayReport.cashOnHand}`);
        console.log(`Short: ₱${todayReport.short}`);
        console.log(`Over: ₱${todayReport.over}`);
        console.log(`Submitted At: ${todayReport.createdAt}`);
        console.log(`Verified: ${todayReport.isVerified || false}`);
      } else {
        console.log('\n❌ No report found for today');
      }
      
    } else {
      console.log('❌ No teller reports found for Mary Gold');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });