import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function checkSameDayDuplicates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all payrolls from November 2025
    const startDate = new Date('2025-11-01T00:00:00.000Z');
    const endDate = new Date('2025-11-30T23:59:59.999Z');

    console.log(`📅 Checking November 2025 for SAME DAY duplicates\n`);

    const payrolls = await Payroll.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('user', 'username role').lean();

    console.log(`📊 Found ${payrolls.length} payrolls in November\n`);

    // Group by user AND exact date (same day)
    const dayGroups = {};
    payrolls.forEach(p => {
      const userId = p.user?._id?.toString() || p.user?.toString();
      const payrollDate = new Date(p.createdAt);
      const dateKey = payrollDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const key = `${userId}_${dateKey}`;
      if (!dayGroups[key]) {
        dayGroups[key] = {
          userId,
          date: dateKey,
          username: p.user?.username || 'Unknown',
          role: p.user?.role || 'Unknown',
          payrolls: []
        };
      }
      dayGroups[key].payrolls.push(p);
    });

    // Find duplicates (more than 1 payroll per user on SAME day)
    const duplicates = Object.values(dayGroups).filter(g => g.payrolls.length > 1);
    
    if (duplicates.length === 0) {
      console.log('✅ No same-day duplicate payrolls found!');
      await mongoose.disconnect();
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} user-days with SAME DAY duplicates\n`);
    
    duplicates.forEach(group => {
      const { userId, date, username, role, payrolls: userPayrolls } = group;
      
      console.log(`👤 ${username} (${role}) - ${date} - ${userPayrolls.length} payrolls on SAME day:`);
      userPayrolls.forEach((p, i) => {
        console.log(`   #${i + 1}: Base=₱${p.baseSalary} Over=₱${p.over} Short=₱${p.short} Total=₱${p.totalSalary} [${p._id.toString().slice(-8)}] Created: ${new Date(p.createdAt).toISOString()}`);
      });
      console.log('');
    });

    console.log(`\n📊 Summary: ${duplicates.length} users have multiple payrolls on the SAME day`);

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkSameDayDuplicates();
