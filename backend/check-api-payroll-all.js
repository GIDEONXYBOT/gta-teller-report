import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkPayrollAll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Simulate what the API endpoint does
    const payrolls = await Payroll.find()
      .populate("user", "username name role active status")
      .sort({ createdAt: -1 })
      .lean();

    console.log(`📦 Total payrolls returned: ${payrolls.length}\n`);

    // Filter to Nov 10
    const nov10Payrolls = payrolls.filter(p => {
      const date = new Date(p.createdAt || p.date);
      return date.getFullYear() === 2025 && 
             date.getMonth() === 10 && // November (0-indexed)
             date.getDate() === 10;
    });

    console.log(`📅 Nov 10 payrolls: ${nov10Payrolls.length}\n`);

    // Group by user ID to check for duplicates
    const byUserId = new Map();
    nov10Payrolls.forEach(p => {
      const userId = p.user?._id?.toString() || 'NO_USER';
      if (!byUserId.has(userId)) {
        byUserId.set(userId, []);
      }
      byUserId.get(userId).push(p);
    });

    // Check for any user with multiple Nov 10 payrolls
    console.log('👥 Checking for duplicate payrolls by user:\n');
    let hasDuplicates = false;
    
    for (const [userId, userPayrolls] of byUserId) {
      if (userPayrolls.length > 1) {
        hasDuplicates = true;
        const name = userPayrolls[0].user?.name || userPayrolls[0].user?.username || 'Unknown';
        console.log(`❌ DUPLICATE FOUND: ${name} (${userId})`);
        console.log(`   Has ${userPayrolls.length} payrolls on Nov 10:`);
        userPayrolls.forEach((p, i) => {
          console.log(`   ${i+1}. ID: ${p._id}, Base: ₱${p.baseSalary}, Over: ₱${p.over}, Total: ₱${p.totalSalary}`);
        });
        console.log('');
      } else {
        const name = userPayrolls[0].user?.name || userPayrolls[0].user?.username || 'Unknown';
        console.log(`✅ ${name}: 1 payroll`);
      }
    }

    if (!hasDuplicates) {
      console.log('\n✅ No duplicates found in Nov 10 payrolls');
    } else {
      console.log('\n❌ DUPLICATES DETECTED - API is returning duplicate data!');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkPayrollAll();
