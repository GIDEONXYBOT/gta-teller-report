import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import TellerReport from './models/TellerReport.js';
import dotenv from 'dotenv';

dotenv.config();

async function deleteOrphanedPayrolls() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all payrolls
    const allPayrolls = await Payroll.find()
      .populate('user', 'username name role')
      .sort({ createdAt: 1 })
      .lean();

    const toDelete = [];

    // Check each payroll
    for (const payroll of allPayrolls) {
      if (!payroll.user || !payroll.user._id) continue;
      if (payroll.user.role === 'admin' || payroll.user.role === 'super_admin') continue;

      // Skip if payroll has no over/short (base salary only is OK)
      if (payroll.over === 0 && payroll.short === 0) continue;

      // Check if there's a matching teller report for this date
      const payrollDate = new Date(payroll.createdAt || payroll.date);
      const dayStart = new Date(payrollDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(payrollDate);
      dayEnd.setHours(23, 59, 59, 999);

      const report = await TellerReport.findOne({
        user: payroll.user._id,
        createdAt: { $gte: dayStart, $lte: dayEnd }
      });

      if (!report) {
        toDelete.push({
          _id: payroll._id,
          userId: payroll.user._id,
          userName: payroll.user.name || payroll.user.username,
          role: payroll.user.role,
          date: payrollDate.toISOString().split('T')[0],
          baseSalary: payroll.baseSalary,
          over: payroll.over,
          short: payroll.short,
          totalSalary: payroll.totalSalary
        });
      }
    }

    console.log(`🗑️  Found ${toDelete.length} orphaned payrolls to delete\n`);

    if (toDelete.length === 0) {
      console.log('✅ No orphaned payrolls found!');
      await mongoose.disconnect();
      return;
    }

    // Group by user for display
    const byUser = new Map();
    toDelete.forEach(p => {
      if (!byUser.has(p.userName)) {
        byUser.set(p.userName, []);
      }
      byUser.get(p.userName).push(p);
    });

    console.log('📋 Orphaned payrolls by user:\n');
    for (const [userName, payrolls] of byUser) {
      console.log(`👤 ${userName} (${payrolls[0].role}): ${payrolls.length} orphaned payrolls`);
      payrolls.forEach(p => {
        console.log(`   - ${p.date}: Base ₱${p.baseSalary}, Over ₱${p.over}, Short ₱${p.short}, Total ₱${p.totalSalary}`);
      });
      console.log('');
    }

    console.log('\n⚠️  Deleting these orphaned payrolls...\n');

    // Delete all orphaned payrolls
    const idsToDelete = toDelete.map(p => p._id);
    const result = await Payroll.deleteMany({ _id: { $in: idsToDelete } });

    console.log(`✅ Deleted ${result.deletedCount} orphaned payroll records`);

    // Verify
    const remaining = await Payroll.countDocuments();
    console.log(`📊 Remaining payrolls in database: ${remaining}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

deleteOrphanedPayrolls();
