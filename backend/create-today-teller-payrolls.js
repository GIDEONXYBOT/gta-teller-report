import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import Capital from './models/Capital.js';
import User from './models/User.js';

dotenv.config();

async function createTodayTellerPayrolls() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log(`📅 Creating payrolls for: ${today.toISOString().split('T')[0]}\n`);
    console.log('='.repeat(80));

    // Get capitals given today
    const capitals = await Capital.find({
      createdAt: { $gte: today, $lt: tomorrow }
    }).populate('tellerId', 'username name role baseSalary').lean();

    console.log(`\n💵 Found ${capitals.length} capital distributions today\n`);

    let created = 0;
    let skipped = 0;

    for (const capital of capitals) {
      if (!capital.tellerId) {
        console.log(`⚠️  Skipping capital with no teller ID`);
        skipped++;
        continue;
      }

      const teller = capital.tellerId;
      const tellerName = teller.username || teller.name || 'Unknown';

      // Check if payroll already exists
      const existing = await Payroll.findOne({
        user: teller._id,
        createdAt: { $gte: today, $lt: tomorrow }
      }).lean();

      if (existing) {
        console.log(`⏭️  ${tellerName}: Payroll already exists`);
        skipped++;
        continue;
      }

      // Create new payroll with base salary
      const baseSalary = teller.baseSalary || 450;
      const newPayroll = await Payroll.create({
        user: teller._id,
        role: teller.role || 'teller',
        baseSalary,
        over: 0,
        short: 0,
        deduction: 0,
        withdrawal: 0,
        totalSalary: baseSalary,
        createdAt: today
      });

      console.log(`✅ ${tellerName}: Created payroll - Base=₱${baseSalary}, Total=₱${baseSalary}`);
      created++;
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 SUMMARY:\n`);
    console.log(`   Created: ${created} payrolls`);
    console.log(`   Skipped: ${skipped} (already existed)`);
    console.log(`   Total: ${capitals.length} capital distributions`);

    console.log('\n💡 NOTE: Over/short amounts will be added when tellers submit their reports');
    console.log('   Current payrolls show base salary only.');

    await mongoose.disconnect();
    console.log('\n✅ Done');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTodayTellerPayrolls();
