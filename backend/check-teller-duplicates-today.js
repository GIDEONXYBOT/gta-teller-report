import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function checkTellerDuplicatesToday() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check today's payrolls
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('📅 Checking date:', today.toISOString().split('T')[0], '\n');

    // Get all tellers
    const tellers = await User.find({ role: 'teller' }).lean();
    console.log(`👥 Found ${tellers.length} tellers\n`);

    let duplicatesFound = 0;

    for (const teller of tellers) {
      const payrolls = await Payroll.find({
        userId: teller._id,
        date: { $gte: today, $lt: tomorrow }
      }).lean();

      if (payrolls.length > 1) {
        duplicatesFound++;
        console.log(`⚠️  ${teller.username} has ${payrolls.length} payrolls:`);
        
        payrolls.forEach((p, i) => {
          console.log(`   #${i + 1} [ID: ...${p._id.toString().slice(-8)}]`);
          console.log(`      Base: ₱${p.baseSalary || 0}`);
          console.log(`      Over: ₱${p.over || 0}`);
          console.log(`      Short: ₱${p.short || 0}`);
          console.log(`      Total: ₱${p.totalSalary || 0}`);
          console.log(`      Approved: ${p.approved ? '✅' : '❌'}`);
        });
        
        // Show what should be combined
        const totalBase = payrolls.reduce((sum, p) => sum + (p.baseSalary || 0), 0);
        const totalOver = payrolls.reduce((sum, p) => sum + (p.over || 0), 0);
        const totalShort = payrolls.reduce((sum, p) => sum + (p.short || 0), 0);
        const totalSalary = payrolls.reduce((sum, p) => sum + (p.totalSalary || 0), 0);
        
        console.log(`   💡 SHOULD BE COMBINED INTO ONE:`);
        console.log(`      Base: ₱${totalBase} | Over: ₱${totalOver} | Short: ₱${totalShort} | Total: ₱${totalSalary}\n`);
      }
    }

    if (duplicatesFound === 0) {
      console.log('✅ No duplicate payrolls found for tellers today!');
    } else {
      console.log(`\n⚠️  Found ${duplicatesFound} tellers with duplicate payrolls`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Done');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTellerDuplicatesToday();
