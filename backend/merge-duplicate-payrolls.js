import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function mergeDuplicatePayrolls() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get current week range (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    console.log(`📅 Processing week: ${monday.toISOString().split('T')[0]} to ${sunday.toISOString().split('T')[0]}\n`);

    // Find all payrolls for this week
    const payrolls = await Payroll.find({
      createdAt: { $gte: monday, $lte: sunday }
    }).populate('user', 'username role').lean();

    console.log(`📊 Found ${payrolls.length} payrolls this week\n`);

    // Group by user
    const userGroups = {};
    payrolls.forEach(p => {
      const userId = p.user?._id?.toString() || p.user?.toString();
      if (!userGroups[userId]) {
        userGroups[userId] = [];
      }
      userGroups[userId].push(p);
    });

    // Find and merge duplicates
    const duplicates = Object.entries(userGroups).filter(([_, payrolls]) => payrolls.length > 1);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate payrolls found this week!');
      await mongoose.disconnect();
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} users with duplicate payrolls\n`);
    
    let merged = 0;
    let deleted = 0;

    for (const [userId, userPayrolls] of duplicates) {
      const username = userPayrolls[0].user?.username || 'Unknown';
      const role = userPayrolls[0].user?.role || 'Unknown';
      
      console.log(`\n👤 ${username} (${role}) - ${userPayrolls.length} payrolls:`);
      
      // Calculate combined totals
      const totalBase = userPayrolls.reduce((sum, p) => sum + (p.baseSalary || 0), 0);
      const totalOver = userPayrolls.reduce((sum, p) => sum + (p.over || 0), 0);
      const totalShort = userPayrolls.reduce((sum, p) => sum + (p.short || 0), 0);
      const totalDeduction = userPayrolls.reduce((sum, p) => sum + (p.deduction || 0), 0);
      const totalWithdrawal = userPayrolls.reduce((sum, p) => sum + (p.withdrawal || 0), 0);
      const totalSalary = totalBase + totalOver - totalShort - totalDeduction - totalWithdrawal;
      
      // Use the first/oldest payroll
      const keepPayroll = userPayrolls.sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      )[0];
      
      const otherPayrolls = userPayrolls.slice(1);
      
      console.log(`   📝 Current values:`);
      userPayrolls.forEach((p, i) => {
        console.log(`      #${i + 1}: Base=₱${p.baseSalary} Over=₱${p.over} Short=₱${p.short} Total=₱${p.totalSalary} [${p._id.toString().slice(-8)}]`);
      });
      
      console.log(`   ✅ Merged values: Base=₱${totalBase} Over=₱${totalOver} Short=₱${totalShort} Total=₱${totalSalary}`);
      
      // Update the kept payroll with combined values
      await Payroll.findByIdAndUpdate(keepPayroll._id, {
        baseSalary: totalBase,
        over: totalOver,
        short: totalShort,
        deduction: totalDeduction,
        withdrawal: totalWithdrawal,
        totalSalary: totalSalary,
        createdAt: monday // Ensure it's set to Monday
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
    console.log(`   ✅ Merged ${merged} users' payrolls`);
    console.log(`   🗑️  Deleted ${deleted} duplicate payrolls`);

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

mergeDuplicatePayrolls();
