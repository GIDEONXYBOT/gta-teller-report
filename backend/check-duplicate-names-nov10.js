import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function checkDuplicatesByName() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const nov10Start = new Date('2025-11-10T00:00:00Z');
    const nov10End = new Date('2025-11-11T00:00:00Z');

    console.log(`📅 Checking Nov 10 payrolls - looking for same name duplicates\n`);
    console.log('='.repeat(80));

    const payrolls = await Payroll.find({
      createdAt: { $gte: nov10Start, $lt: nov10End }
    }).populate('user', 'username name role').sort({ createdAt: 1 }).lean();

    console.log(`\n💰 Total payrolls: ${payrolls.length}\n`);

    // Group by displayed name (username OR name)
    const byDisplayName = {};
    payrolls.forEach(p => {
      const displayName = p.user?.username || p.user?.name || 'Unknown';
      if (!byDisplayName[displayName]) {
        byDisplayName[displayName] = [];
      }
      byDisplayName[displayName].push(p);
    });

    // Show all
    let foundDuplicates = false;
    for (const [displayName, records] of Object.entries(byDisplayName).sort()) {
      const isDup = records.length > 1;
      if (isDup) foundDuplicates = true;

      console.log(`\n👤 ${displayName}: ${records.length} record${records.length > 1 ? 's' : ''} ${isDup ? '⚠️  DUPLICATE NAME!' : '✅'}`);
      
      records.forEach((p, idx) => {
        console.log(`\n   Record ${idx + 1}:`);
        console.log(`   - Payroll ID: ${p._id}`);
        console.log(`   - User ID: ${p.user._id}`);
        console.log(`   - Username: ${p.user.username || 'N/A'}`);
        console.log(`   - Name: ${p.user.name || 'N/A'}`);
        console.log(`   - Role: ${p.user.role}`);
        console.log(`   - Base: ₱${p.baseSalary}, Over: ₱${p.over}, Short: ₱${p.short}`);
        console.log(`   - Total: ₱${p.totalSalary}`);
        console.log(`   - Created: ${new Date(p.createdAt).toISOString()}`);
        console.log(`   - Timestamp (raw): ${p.createdAt}`);
      });
    }

    if (foundDuplicates) {
      console.log('\n' + '='.repeat(80));
      console.log('\n⚠️  SAME NAME DUPLICATES FOUND!');
      console.log('\nThese could be:');
      console.log('1. Different users with same display name (check User IDs)');
      console.log('2. Actual duplicate payrolls (same User ID)');
      console.log('\nIf same User ID = true duplicate, need to delete one');
      console.log('If different User IDs = different users, just same name (OK)');
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('\n✅ No duplicate names found');
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkDuplicatesByName();
