import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import TellerReport from './models/TellerReport.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifyPayrollsFromImage() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check specific users from the image
    const testUsers = [
      { name: 'marebelen', expected: { count: 3, amounts: [62, 853, 1314] } },
      { name: 'feby', expected: { count: 4, amounts: [326, 236, 464, 482] } },
      { name: 'michelle', expected: { count: 2, amounts: [26, 276] } },
      { name: 'shymaine', expected: { count: 3, amounts: [103, 166, 1224] } }
    ];

    for (const testUser of testUsers) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`👤 Checking: ${testUser.name.toUpperCase()}`);
      console.log(`Expected: ${testUser.expected.count} payrolls with over amounts: ${testUser.expected.amounts.join(', ')}`);
      console.log(`${'='.repeat(60)}\n`);

      const user = await User.findOne({
        $or: [
          { username: new RegExp(testUser.name, 'i') },
          { name: new RegExp(testUser.name, 'i') }
        ]
      });

      if (!user) {
        console.log(`❌ User not found`);
        continue;
      }

      console.log(`Found: ${user.name} (${user.username})`);
      console.log(`User ID: ${user._id}\n`);

      // Get all payrolls
      const payrolls = await Payroll.find({ user: user._id })
        .sort({ createdAt: 1 })
        .lean();

      console.log(`💰 Payrolls in database: ${payrolls.length}`);
      payrolls.forEach((p, i) => {
        const date = new Date(p.createdAt);
        console.log(`   ${i + 1}. ${date.toLocaleDateString()} - Base: ₱${p.baseSalary}, Over: ₱${p.over}, Total: ₱${p.totalSalary}`);
      });

      // Get all teller reports
      const reports = await TellerReport.find({ user: user._id })
        .sort({ createdAt: 1 })
        .lean();

      console.log(`\n📝 Teller reports in database: ${reports.length}`);
      if (reports.length === 0) {
        console.log(`   ⚠️  NO TELLER REPORTS FOUND!`);
      } else {
        reports.forEach((r, i) => {
          const date = new Date(r.createdAt);
          console.log(`   ${i + 1}. ${date.toLocaleDateString()} - Over: ₱${r.over || 0}, Short: ₱${r.short || 0}`);
        });
      }

      // Compare
      const overAmounts = payrolls.map(p => p.over).sort((a, b) => a - b);
      const expectedSorted = testUser.expected.amounts.sort((a, b) => a - b);
      
      console.log(`\n📊 Comparison:`);
      console.log(`   Expected over amounts: [${expectedSorted.join(', ')}]`);
      console.log(`   Actual over amounts:   [${overAmounts.join(', ')}]`);
      
      const matches = JSON.stringify(overAmounts) === JSON.stringify(expectedSorted);
      console.log(`   ${matches ? '✅ MATCHES!' : '❌ DOES NOT MATCH!'}`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

verifyPayrollsFromImage();
