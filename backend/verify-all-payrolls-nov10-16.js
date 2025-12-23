import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import TellerReport from './models/TellerReport.js';
import User from './models/User.js';

dotenv.config();

// Expected data from image
const expectedData = {
  'FEBY': [
    { base: 450, over: 326 },
    { base: 450, over: 236 },
    { base: 450, over: 464 },
    { base: 450, over: 482 }
  ],
  'MICHELLE': [
    { base: 450, over: 26 },
    { base: 450, over: 276 }
  ],
  'SHYMAINE': [
    { base: 450, over: 103 },
    { base: 450, over: 1224 }
  ],
  'KARYLE': [
    { base: 450, over: 67 },
    { base: 450, over: -283 },
    { base: 450, over: 122 }
  ],
  'MARILOU': [
    { base: 450, over: 143 },
    { base: 450, over: 155 },
    { base: 450, over: 480 }
  ],
  'JESYRIE': [
    { base: 450, over: 182 },
    { base: 450, over: 202 }
  ],
  'MAREBELEN': [
    { base: 450, over: 62 },
    { base: 450, over: 853 },
    { base: 450, over: 1314 }
  ],
  'ERIKA': [
    { base: 450, over: 67 },
    { base: 450, over: 312 }
  ],
  'SHEENA': [
    { base: 450, over: 88 },
    { base: 450, over: 89 },
    { base: 450, over: 139 }
  ],
  'MARIE': [
    { base: 450, over: 399 },
    { base: 450, over: 80 },
    { base: 450, over: 1207 }
  ],
  'MARY GOLD': [
    { base: 450, over: 266 },
    { base: 450, over: 269 },
    { base: 450, over: -319 },
    { base: 450, over: -1475 }
  ],
  'IRAH': [
    { base: 450, over: 250 }
  ],
  'ALYANA': [
    { base: 450, over: 38 },
    { base: 450, over: 123 }
  ],
  'MITCH': [
    { base: 450, over: 121 },
    { base: 450, over: 619 },
    { base: 450, over: 444 }
  ],
  'TESSA': [
    { base: 450, over: 358 },
    { base: 450, over: 514 },
    { base: 450, over: 631 }
  ],
  'MARY CLARISS': [
    { base: 450, over: 211 },
    { base: 450, over: 39 },
    { base: 450, over: 178 }
  ],
  'PAO': [
    { base: 450, over: 45 },
    { base: 450, over: 28 },
    { base: 450, over: 152 }
  ],
  'HONEY': [
    { base: 450, over: 406 },
    { base: 450, over: 411 },
    { base: 450, over: 501 }
  ],
  'LARAH': [
    { base: 450, over: 468 },
    { base: 450, over: 821 }
  ],
  'JOVELYN': [
    { base: 450, over: -204 },
    { base: 450, over: -258 }
  ],
  'JENESSA': [
    { base: 450, over: 227 },
    { base: 450, over: 673 }
  ],
  'KISSY': [
    { base: 450, over: 114 },
    { base: 450, over: 89 },
    { base: 450, over: 340 }
  ],
  'CHARM': [
    { base: 450, over: 195 },
    { base: 450, over: 500 }
  ],
  'CHRISTINE': [
    { base: 450, over: 225 }
  ],
  'KEANNA': [
    { base: 450, over: -202 }
  ]
};

async function verifyAllPayrolls() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const startDate = new Date('2025-11-10T00:00:00Z');
    const endDate = new Date('2025-11-17T00:00:00Z');

    console.log('📊 VERIFICATION REPORT (Nov 10-16, 2025)\n');
    console.log('='.repeat(80));

    const issues = [];
    const missing = [];

    for (const [name, expectedPayrolls] of Object.entries(expectedData)) {
      const user = await User.findOne({ 
        $or: [
          { username: new RegExp(name, 'i') },
          { name: new RegExp(name, 'i') }
        ]
      }).lean();

      if (!user) {
        issues.push(`❌ USER NOT FOUND: ${name}`);
        continue;
      }

      // Get all payrolls for this user in date range
      const payrolls = await Payroll.find({
        user: user._id,
        createdAt: { $gte: startDate, $lt: endDate }
      }).sort({ createdAt: 1 }).lean();

      // Get all teller reports
      const reports = await TellerReport.find({
        tellerId: user._id,
        createdAt: { $gte: startDate, $lt: endDate }
      }).sort({ createdAt: 1 }).lean();

      console.log(`\n👤 ${name.toUpperCase()} (${user.username})`);
      console.log(`   Expected: ${expectedPayrolls.length} payrolls`);
      console.log(`   Database: ${payrolls.length} payrolls, ${reports.length} reports`);

      // Compare counts
      if (payrolls.length !== expectedPayrolls.length) {
        issues.push(`⚠️  ${name}: Expected ${expectedPayrolls.length} payrolls, found ${payrolls.length}`);
      }

      // Compare values
      payrolls.forEach((payroll, index) => {
        const expected = expectedPayrolls[index];
        if (expected) {
          const actualOver = payroll.over - payroll.short;
          const expectedOver = expected.over;
          const expectedTotal = expected.base + expected.over;
          const actualTotal = payroll.totalSalary;

          const date = new Date(payroll.createdAt).toISOString().split('T')[0];
          
          if (actualOver !== expectedOver) {
            issues.push(`   ❌ ${name} (${date}): Expected over=${expectedOver}, found ${actualOver}`);
            console.log(`   ❌ Day ${index + 1} (${date}): Over mismatch - Expected ₱${expectedOver}, Got ₱${actualOver}`);
          } else if (actualTotal !== expectedTotal) {
            issues.push(`   ⚠️  ${name} (${date}): Total mismatch - Expected ₱${expectedTotal}, Got ₱${actualTotal}`);
            console.log(`   ⚠️  Day ${index + 1} (${date}): Total mismatch - Expected ₱${expectedTotal}, Got ₱${actualTotal}`);
          } else {
            console.log(`   ✅ Day ${index + 1} (${date}): Base=₱${payroll.baseSalary}, Over=₱${actualOver}, Total=₱${actualTotal}`);
          }
        }
      });

      // Check for missing payrolls
      if (payrolls.length < expectedPayrolls.length) {
        const missingCount = expectedPayrolls.length - payrolls.length;
        missing.push({
          name,
          userId: user._id,
          missingPayrolls: expectedPayrolls.slice(payrolls.length)
        });
        console.log(`   ⚠️  ${missingCount} payroll(s) missing!`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 SUMMARY:\n');
    
    if (issues.length === 0 && missing.length === 0) {
      console.log('✅ All payrolls verified correctly!');
    } else {
      if (issues.length > 0) {
        console.log(`\n⚠️  ${issues.length} ISSUES FOUND:\n`);
        issues.forEach(issue => console.log(issue));
      }
      
      if (missing.length > 0) {
        console.log(`\n📝 ${missing.length} TELLERS WITH MISSING PAYROLLS:\n`);
        missing.forEach(m => {
          console.log(`   ${m.name}: ${m.missingPayrolls.length} missing`);
          m.missingPayrolls.forEach((p, i) => {
            console.log(`      - Missing payroll ${i + 1}: Base=₱${p.base}, Over=₱${p.over}`);
          });
        });
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Verification complete');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyAllPayrolls();
