import TellerReport from './models/TellerReport.js';
import User from './models/User.js';
import mongoose from 'mongoose';

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://rmi_admin:rmi1234@rmi-teller-report.fphrmaw.mongodb.net/rmi?retryWrites=true&w=majority')
  .then(async () => {
    console.log('=== TESTING FORM DATA SUBMISSION ISSUE ===');
    
    const user = await User.findOne({ username: 'mlaburada29' });
    if (!user) {
      console.log('❌ Mary Gold user not found');
      process.exit(1);
    }
    
    console.log(`👤 Mary Gold User ID: ${user._id}`);
    
    // Get the latest report
    const latestReport = await TellerReport.findOne({ tellerId: user._id }).sort({ createdAt: -1 });
    
    if (!latestReport) {
      console.log('❌ No reports found for Mary Gold');
      process.exit(1);
    }
    
    console.log('\n📊 LATEST REPORT DETAILS:');
    console.log('   Report ID:', latestReport._id);
    console.log('   Created At:', latestReport.createdAt);
    console.log('   System Balance:', latestReport.systemBalance);
    console.log('   Cash On Hand:', latestReport.cashOnHand);
    console.log('   Short:', latestReport.short);
    console.log('   Over:', latestReport.over);
    
    console.log('\n💵 DENOMINATIONS:');
    console.log('   ₱1000 x', latestReport.d1000 || 0, '= ₱' + (latestReport.d1000 * 1000 || 0));
    console.log('   ₱500 x', latestReport.d500 || 0, '= ₱' + (latestReport.d500 * 500 || 0));
    console.log('   ₱200 x', latestReport.d200 || 0, '= ₱' + (latestReport.d200 * 200 || 0));
    console.log('   ₱100 x', latestReport.d100 || 0, '= ₱' + (latestReport.d100 * 100 || 0));
    console.log('   ₱50 x', latestReport.d50 || 0, '= ₱' + (latestReport.d50 * 50 || 0));
    console.log('   ₱20 x', latestReport.d20 || 0, '= ₱' + (latestReport.d20 * 20 || 0));
    console.log('   Coins:', latestReport.coins || 0);
    
    // Calculate what the cash on hand should be
    const calculatedCashOnHand = 
      (latestReport.d1000 || 0) * 1000 +
      (latestReport.d500 || 0) * 500 +
      (latestReport.d200 || 0) * 200 +
      (latestReport.d100 || 0) * 100 +
      (latestReport.d50 || 0) * 50 +
      (latestReport.d20 || 0) * 20 +
      (latestReport.coins || 0);
    
    console.log('\n🧮 CALCULATION CHECK:');
    console.log('   Stored Cash On Hand:', latestReport.cashOnHand);
    console.log('   Calculated from Denominations:', calculatedCashOnHand);
    console.log('   Match:', latestReport.cashOnHand === calculatedCashOnHand ? '✅ YES' : '❌ NO');
    
    if (latestReport.cashOnHand !== calculatedCashOnHand) {
      console.log('   🚨 MISMATCH DETECTED!');
      console.log('   Difference:', latestReport.cashOnHand - calculatedCashOnHand);
    }
    
    // Check Short/Over calculation
    const calculatedDiff = calculatedCashOnHand - latestReport.systemBalance;
    const expectedShort = calculatedDiff < 0 ? Math.abs(calculatedDiff) : 0;
    const expectedOver = calculatedDiff > 0 ? calculatedDiff : 0;
    
    console.log('\n💰 SHORT/OVER CHECK:');
    console.log('   System Balance:', latestReport.systemBalance);
    console.log('   Calculated Difference:', calculatedDiff);
    console.log('   Expected Short:', expectedShort);
    console.log('   Stored Short:', latestReport.short);
    console.log('   Expected Over:', expectedOver);
    console.log('   Stored Over:', latestReport.over);
    console.log('   Short Match:', latestReport.short === expectedShort ? '✅ YES' : '❌ NO');
    console.log('   Over Match:', latestReport.over === expectedOver ? '✅ YES' : '❌ NO');
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);
  });