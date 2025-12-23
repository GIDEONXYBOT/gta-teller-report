import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import TellerReport from './models/TellerReport.js';
import dotenv from 'dotenv';

dotenv.config();

async function investigateMarebelenNov9() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find Marebelen
    const marebelen = await User.findOne({ username: /marebelen/i });
    console.log(`👤 Marebelen: ${marebelen.name} (${marebelen._id})\n`);

    // Find Nov 9 payroll
    const nov9Start = new Date('2025-11-09T00:00:00Z');
    const nov9End = new Date('2025-11-09T23:59:59Z');

    const nov9Payroll = await Payroll.findOne({
      user: marebelen._id,
      createdAt: { $gte: nov9Start, $lte: nov9End }
    });

    if (!nov9Payroll) {
      console.log('❌ No Nov 9 payroll found');
      await mongoose.disconnect();
      return;
    }

    console.log('💰 Nov 9 Payroll:');
    console.log(`   ID: ${nov9Payroll._id}`);
    console.log(`   Base: ₱${nov9Payroll.baseSalary}`);
    console.log(`   Over: ₱${nov9Payroll.over}`);
    console.log(`   Short: ₱${nov9Payroll.short}`);
    console.log(`   Total: ₱${nov9Payroll.totalSalary}`);
    console.log(`   Created: ${nov9Payroll.createdAt}`);
    console.log(`   Adjustments: ${JSON.stringify(nov9Payroll.adjustments || [], null, 2)}`);
    console.log('');

    // Find Nov 9 teller report
    const nov9Report = await TellerReport.findOne({
      user: marebelen._id,
      createdAt: { $gte: nov9Start, $lte: nov9End }
    });

    if (nov9Report) {
      console.log('📝 Nov 9 Teller Report:');
      console.log(`   ID: ${nov9Report._id}`);
      console.log(`   Over: ₱${nov9Report.over || 0}`);
      console.log(`   Short: ₱${nov9Report.short || 0}`);
      console.log(`   Created: ${nov9Report.createdAt}`);
      console.log(`   Display Data: ${JSON.stringify(nov9Report.displayData || {}, null, 2)}`);
    } else {
      console.log('⚠️  No Nov 9 teller report found');
    }

    console.log('\n🔍 Analysis:');
    console.log(`   Expected over amount should match teller report`);
    console.log(`   Current payroll over: ₱${nov9Payroll.over}`);
    if (nov9Report) {
      console.log(`   Teller report over: ₱${nov9Report.over || 0}`);
      if (nov9Payroll.over !== (nov9Report.over || 0)) {
        console.log(`   ⚠️  MISMATCH! Payroll and report don't match`);
      }
    }

    // Check if there are multiple Nov 9 teller reports
    const allNov9Reports = await TellerReport.find({
      user: marebelen._id,
      createdAt: { $gte: nov9Start, $lte: nov9End }
    });

    console.log(`\n📊 Total Nov 9 reports: ${allNov9Reports.length}`);
    if (allNov9Reports.length > 1) {
      console.log('⚠️  Multiple reports found for Nov 9:');
      allNov9Reports.forEach((r, i) => {
        console.log(`   ${i + 1}. ID: ${r._id}, Over: ₱${r.over || 0}, Created: ${r.createdAt}`);
      });
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

investigateMarebelenNov9();
