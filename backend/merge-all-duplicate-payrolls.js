import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function mergeAllDuplicates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all payrolls from November 2025
    const startDate = new Date('2025-11-01T00:00:00.000Z');
    const endDate = new Date('2025-11-30T23:59:59.999Z');

    console.log(`📅 Checking November 2025 payrolls\n`);

    // Find all payrolls
    const payrolls = await Payroll.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('user', 'username role').lean();

    console.log(`📊 Found ${payrolls.length} payrolls in November\n`);

    // Group by user AND week
    const weekGroups = {};
    payrolls.forEach(p => {
      const userId = p.user?._id?.toString() || p.user?.toString();
      
      // Calculate Monday of the week for this payroll
      const payrollDate = new Date(p.createdAt);
      const dayOfWeek = payrollDate.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(payrollDate);
      monday.setDate(monday.getDate() - daysFromMonday);
      monday.setHours(0, 0, 0, 0);
      const weekKey = monday.toISOString().split('T')[0];
      
      const key = `${userId}_${weekKey}`;
      if (!weekGroups[key]) {
        weekGroups[key] = {
          userId,
          weekStart: weekKey,
          username: p.user?.username || 'Unknown',
          role: p.user?.role || 'Unknown',
          payrolls: []
        };
      }
      weekGroups[key].payrolls.push(p);
    });

    // Find duplicates (more than 1 payroll per user per week)
    const duplicates = Object.values(weekGroups).filter(g => g.payrolls.length > 1);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate payrolls found in November!');
      await mongoose.disconnect();
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} user-weeks with duplicate payrolls\n`);
    
    let merged = 0;
    let deleted = 0;

    for (const group of duplicates) {
      const { userId, weekStart, username, role, payrolls: userPayrolls } = group;
      
      console.log(`\n👤 ${username} (${role}) - Week of ${weekStart} - ${userPayrolls.length} payrolls:`);
      
      // Calculate combined totals
      let totalBase = 0;
      let totalOver = 0;
      let totalShort = 0;
      let totalDeduction = 0;
      let totalWithdrawal = 0;
      
      // Use max for base salary (should be same for all)
      const baseSalaries = userPayrolls.map(p => p.baseSalary || 0);
      totalBase = Math.max(...baseSalaries);
      
      // Sum the over/short/deduction/withdrawal values
      totalOver = userPayrolls.reduce((sum, p) => sum + (p.over || 0), 0);
      totalShort = userPayrolls.reduce((sum, p) => sum + (p.short || 0), 0);
      totalDeduction = userPayrolls.reduce((sum, p) => sum + (p.deduction || 0), 0);
      totalWithdrawal = userPayrolls.reduce((sum, p) => sum + (p.withdrawal || 0), 0);
      
      const totalSalary = totalBase + totalOver - totalShort - totalDeduction - totalWithdrawal;
      
      // Use the first/oldest payroll
      const keepPayroll = userPayrolls.sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      )[0];
      
      const otherPayrolls = userPayrolls.slice(1);
      
      console.log(`   📝 Current payrolls:`);
      userPayrolls.forEach((p, i) => {
        console.log(`      #${i + 1}: Base=₱${p.baseSalary} Over=₱${p.over} Short=₱${p.short} Total=₱${p.totalSalary} Created=${new Date(p.createdAt).toISOString().split('T')[0]} [${p._id.toString().slice(-8)}]`);
      });
      
      console.log(`   ✅ Merged: Base=₱${totalBase} Over=₱${totalOver} Short=₱${totalShort} Deduction=₱${totalDeduction} Withdrawal=₱${totalWithdrawal} Total=₱${totalSalary}`);
      
      // Calculate Monday for this week
      const mondayDate = new Date(weekStart);
      
      // Update the kept payroll with combined values
      await Payroll.findByIdAndUpdate(keepPayroll._id, {
        baseSalary: totalBase,
        over: totalOver,
        short: totalShort,
        deduction: totalDeduction,
        withdrawal: totalWithdrawal,
        totalSalary: totalSalary,
        createdAt: mondayDate // Ensure it's set to Monday
      });
      
      // Delete the other payrolls
      for (const p of otherPayrolls) {
        await Payroll.findByIdAndDelete(p._id);
        deleted++;
      }
      
      merged++;
      console.log(`   ✅ Kept payroll ${keepPayroll._id.toString().slice(-8)}, deleted ${otherPayrolls.length} duplicates`);
    }

    console.log(`\n🎉 Summary:`);
    console.log(`   ✅ Merged ${merged} user-weeks`);
    console.log(`   🗑️  Deleted ${deleted} duplicate payrolls`);

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

mergeAllDuplicates();
