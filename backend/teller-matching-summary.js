import mongoose from 'mongoose';
import User from './models/User.js';
import TellerMapping from './models/TellerMapping.js';

async function showTellerMatchingSummary() {
  try {
    console.log('🎯 RMI Teller Matching System - Summary Report');
    console.log('==============================================\n');

    // Connect to database
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');
    console.log('✅ Connected to database\n');

    // Get system statistics
    const totalReportingTellers = await User.countDocuments({ role: 'teller' });
    const approvedReportingTellers = await User.countDocuments({ role: 'teller', status: 'approved' });
    const totalMappings = await TellerMapping.countDocuments({ isActive: true });

    console.log('📊 SYSTEM STATISTICS:');
    console.log(`   Total tellers in reporting system: ${totalReportingTellers}`);
    console.log(`   Approved tellers in reporting system: ${approvedReportingTellers}`);
    console.log(`   Active teller mappings: ${totalMappings}`);
    console.log('');

    // Show mapping details
    console.log('🔗 ACTIVE TELLER MAPPINGS:');
    console.log('==========================');

    const mappings = await TellerMapping.find({ isActive: true })
      .populate('tellerId', 'username name')
      .sort({ createdAt: -1 });

    if (mappings.length === 0) {
      console.log('   No active mappings found.');
    } else {
      mappings.forEach((mapping, i) => {
        console.log(`${i+1}. ${mapping.tellerId.username} (${mapping.tellerId.name})`);
        console.log(`   ↳ Maps to: ${mapping.bettingUsername} (${mapping.bettingName})`);
        console.log(`   ↳ Match type: ${mapping.matchConfidence} - ${mapping.matchReason}`);
        console.log(`   ↳ Last bet amount: ₱${mapping.bettingData.lastBetAmount || 0}`);
        console.log(`   ↳ Last sync: ${mapping.bettingData.lastSyncDate || 'Never'}`);
        console.log('');
      });
    }

    // Show unmatched tellers
    const mappedTellerIds = mappings.map(m => m.tellerId._id.toString());
    const unmatchedReportingTellers = await User.find({
      role: 'teller',
      status: 'approved',
      _id: { $nin: mappedTellerIds }
    }).select('username name').sort('username');

    console.log('📋 UNMATCHED REPORTING TELLERS:');
    console.log('================================');

    if (unmatchedReportingTellers.length === 0) {
      console.log('   All approved tellers are matched! 🎉');
    } else {
      unmatchedReportingTellers.forEach((teller, i) => {
        console.log(`${i+1}. ${teller.username} - ${teller.name || 'No name'}`);
      });
    }

    console.log('\n✅ SUMMARY:');
    console.log(`   Matching coverage: ${mappings.length}/${approvedReportingTellers} approved tellers (${Math.round((mappings.length/approvedReportingTellers)*100) || 0}%)`);
    console.log(`   System ready for integrated reporting: ${mappings.length > 0 ? 'YES' : 'NO'}`);

  } catch (error) {
    console.error('❌ Error generating summary:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the summary
showTellerMatchingSummary();