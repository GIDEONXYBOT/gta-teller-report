import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function checkLaraWeekly() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const lara = await User.findOne({ username: /lara/i }).lean();
    if (!lara) {
      console.log('❌ Lara not found');
      process.exit(1);
    }

    console.log(`👤 ${lara.username}\n`);

    // Current week (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    console.log(`📅 Current week: ${monday.toISOString().split('T')[0]} to ${sunday.toISOString().split('T')[0]}\n`);

    const payrolls = await Payroll.find({
      user: lara._id,
      createdAt: { $gte: monday, $lte: sunday }
    }).sort({ createdAt: 1 }).lean();

    console.log(`Payrolls this week: ${payrolls.length}\n`);
    
    if (payrolls.length === 0) {
      console.log('⚠️  No payrolls found for current week');
    } else {
      payrolls.forEach(p => {
        const date = new Date(p.createdAt).toISOString().split('T')[0];
        const dayName = new Date(p.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
        console.log(`   ${dayName} ${date}: Base=₱${p.baseSalary} Over=₱${p.over} Short=₱${p.short} Total=₱${p.totalSalary}`);
      });
    }

    // Check all her payrolls
    console.log('\n📊 All Lara payrolls:');
    const allPayrolls = await Payroll.find({ user: lara._id }).sort({ createdAt: -1 }).limit(10).lean();
    allPayrolls.forEach(p => {
      const date = new Date(p.createdAt).toISOString().split('T')[0];
      console.log(`   ${date}: Base=₱${p.baseSalary} Over=₱${p.over} Short=₱${p.short} Total=₱${p.totalSalary}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkLaraWeekly();
