import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixPayrollsWithTerms() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all payrolls with shortPaymentTerms > 1 or short > 0
    const payrolls = await Payroll.find({
      $or: [
        { shortPaymentTerms: { $gt: 1 } },
        { short: { $gt: 0 } }
      ]
    });

    console.log(`📦 Found ${payrolls.length} payrolls with shorts or payment terms\n`);

    let fixed = 0;
    let alreadyCorrect = 0;

    for (const payroll of payrolls) {
      const baseSalary = payroll.baseSalary || 0;
      const over = payroll.over || 0;
      const short = payroll.short || 0;
      const deduction = payroll.deduction || 0;
      const terms = payroll.shortPaymentTerms || 1;
      
      const weeklyShortDeduction = short / terms;
      const expectedTotal = baseSalary + over - weeklyShortDeduction - deduction;
      const currentTotal = payroll.totalSalary;
      
      // Check if total needs fixing (allow 0.01 difference for rounding)
      if (Math.abs(currentTotal - expectedTotal) > 0.01) {
        console.log(`🔧 Fixing payroll ID: ${payroll._id}`);
        console.log(`   Date: ${new Date(payroll.createdAt).toLocaleDateString()}`);
        console.log(`   Base: ₱${baseSalary}, Over: ₱${over}, Short: ₱${short}, Deduction: ₱${deduction}`);
        console.log(`   Terms: ${terms} weeks, Weekly Short: ₱${weeklyShortDeduction.toFixed(2)}`);
        console.log(`   Old Total: ₱${currentTotal} → New Total: ₱${expectedTotal.toFixed(2)}`);
        
        payroll.totalSalary = expectedTotal;
        
        // Add adjustment note
        payroll.adjustments = payroll.adjustments || [];
        payroll.adjustments.push({
          delta: expectedTotal - currentTotal,
          reason: `Auto-fix: Recalculated with payment terms (${terms} weeks, ₱${weeklyShortDeduction.toFixed(2)}/week instead of full ₱${short})`,
          createdAt: new Date(),
        });
        
        await payroll.save();
        fixed++;
        console.log(`   ✅ Fixed!\n`);
      } else {
        alreadyCorrect++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total checked: ${payrolls.length}`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Already correct: ${alreadyCorrect}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

fixPayrollsWithTerms();
