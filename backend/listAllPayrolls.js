// listAllPayrolls.js
// List all payrolls grouped by user to see duplicates
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payroll from './models/Payroll.js';

dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function run() {
  try {
    console.log('Connecting to', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Get all payrolls
    const allPayrolls = await Payroll.find({})
      .populate('user', 'name username role baseSalary')
      .sort({ user: 1, createdAt: 1 })
      .lean();

    console.log(`Found ${allPayrolls.length} total payrolls\n`);

    // Group by user
    const payrollsByUser = new Map();
    
    for (const payroll of allPayrolls) {
      if (!payroll.user || !payroll.user._id) {
        console.log(`⚠️  Orphaned payroll ${payroll._id} - no user`);
        continue;
      }

      const userId = String(payroll.user._id);
      if (!payrollsByUser.has(userId)) {
        payrollsByUser.set(userId, []);
      }
      payrollsByUser.get(userId).push(payroll);
    }

    console.log(`\n=== PAYROLLS BY USER ===\n`);

    for (const [userId, payrolls] of payrollsByUser) {
      const user = payrolls[0].user;
      console.log(`\n👤 ${user.name || user.username} (${user.role})`);
      console.log(`   User.baseSalary: ₱${user.baseSalary || 0}`);
      console.log(`   Total payrolls: ${payrolls.length}`);

      if (payrolls.length > 1) {
        console.log(`   ⚠️  MULTIPLE PAYROLLS FOUND!`);
      }

      payrolls.forEach((p, index) => {
        console.log(`\n   Payroll #${index + 1} (${p._id}):`);
        console.log(`     Date: ${p.date || 'N/A'}`);
        console.log(`     CreatedAt: ${p.createdAt}`);
        console.log(`     Base: ₱${p.baseSalary || 0}`);
        console.log(`     Over: ₱${p.over || 0}, Short: ₱${p.short || 0}`);
        console.log(`     DaysPresent: ${p.daysPresent || 'N/A'}`);
        console.log(`     Total: ₱${p.totalSalary || 0}`);
      });
    }

    console.log(`\n\n=== SUMMARY ===`);
    console.log(`Total users: ${payrollsByUser.size}`);
    
    const usersWithMultiple = Array.from(payrollsByUser.values()).filter(p => p.length > 1);
    console.log(`Users with multiple payrolls: ${usersWithMultiple.length}`);
    
    if (usersWithMultiple.length > 0) {
      console.log(`\n⚠️  Users with duplicates:`);
      usersWithMultiple.forEach(payrolls => {
        const user = payrolls[0].user;
        console.log(`   - ${user.name || user.username}: ${payrolls.length} payrolls`);
      });
    }

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
