import TellerReport from './models/TellerReport.js';
import User from './models/User.js';
import mongoose from 'mongoose';

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://rmi_admin:rmi1234@rmi-teller-report.fphrmaw.mongodb.net/rmi?retryWrites=true&w=majority')
  .then(async () => {
    console.log('=== MARY GOLD REPORTS ANALYSIS ===');
    
    const user = await User.findOne({ username: 'mlaburada29' });
    if (!user) {
      console.log('❌ Mary Gold user not found');
      process.exit(1);
    }
    
    console.log(`👤 Mary Gold User ID: ${user._id}`);
    
    // Get all reports
    const reports = await TellerReport.find({ tellerId: user._id }).sort({ createdAt: -1 }).limit(5);
    
    console.log(`📊 Found ${reports.length} recent reports\n`);
    
    reports.forEach((report, index) => {
      console.log(`📋 Report ${index + 1} (${report.createdAt}):`);
      console.log(`   System Balance: ₱${report.systemBalance}`);
      console.log(`   Cash On Hand: ₱${report.cashOnHand}`);
      console.log(`   Short: ₱${report.short}, Over: ₱${report.over}`);
      
      // Calculate what should be the cash on hand
      const calculated = 
        (report.d1000 || 0) * 1000 +
        (report.d500 || 0) * 500 +
        (report.d200 || 0) * 200 +
        (report.d100 || 0) * 100 +
        (report.d50 || 0) * 50 +
        (report.d20 || 0) * 20 +
        (report.coins || 0);
      
      console.log(`   Denominations: ₱1000×${report.d1000||0} ₱500×${report.d500||0} ₱200×${report.d200||0} ₱100×${report.d100||0} ₱50×${report.d50||0} ₱20×${report.d20||0} Coins:₱${report.coins||0}`);
      console.log(`   Calculated Cash: ₱${calculated} ${calculated === report.cashOnHand ? '✅' : '❌'}`);
      
      // Check if this report has any inconsistencies
      if (calculated !== report.cashOnHand) {
        console.log(`   🚨 MISMATCH: Expected ₱${calculated}, got ₱${report.cashOnHand}`);
      }
      
      console.log('   ---');
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });