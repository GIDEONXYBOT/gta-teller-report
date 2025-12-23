import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function fixLaraPayroll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find Lara
    const lara = await User.findOne({ username: /lara/i }).lean();
    if (!lara) {
      console.log('❌ Lara not found');
      process.exit(1);
    }

    console.log(`👤 Found: ${lara.username}\n`);

    // Update the payroll from Nov 15 to Nov 16
    const result = await Payroll.updateOne(
      { 
        user: lara._id,
        createdAt: { 
          $gte: new Date('2025-11-15T00:00:00.000Z'),
          $lt: new Date('2025-11-16T00:00:00.000Z')
        }
      },
      { 
        createdAt: new Date('2025-11-16T00:00:00.000Z')
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ Updated Lara's payroll from Nov 15 to Nov 16`);
    } else {
      console.log(`⚠️ No payroll found to update`);
    }

    // Verify
    const payrolls = await Payroll.find({ user: lara._id }).sort({ createdAt: -1 }).lean();
    console.log(`\nCurrent payrolls (${payrolls.length}):`);
    payrolls.forEach(p => {
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

fixLaraPayroll();
