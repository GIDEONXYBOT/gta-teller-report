import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkAdjustments() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all payrolls with adjustments
    const payrolls = await Payroll.find({
      adjustments: { $exists: true, $ne: [] }
    });

    console.log(`📦 Found ${payrolls.length} payrolls with adjustments\n`);

    let needsFix = 0;
    
    for (const p of payrolls) {
      const base = p.baseSalary || 0;
      const over = p.over || 0;
      const short = p.short || 0;
      const deduction = p.deduction || 0;
      const terms = p.shortPaymentTerms || 1;
      const weeklyShort = short / terms;
      
      // Calculate what total SHOULD be without adjustments
      const baseTotal = base + over - weeklyShort - deduction;
      
      // Calculate total adjustments delta
      const adjustmentsDelta = p.adjustments.reduce((sum, adj) => sum + (adj.delta || 0), 0);
      
      // Expected total WITH adjustments
      const expectedTotal = baseTotal + adjustmentsDelta;
      
      const currentTotal = p.totalSalary || 0;
      
      console.log(`📅 ${new Date(p.createdAt || p.date).toLocaleDateString()} - ID: ${p._id}`);
      console.log(`   Base: ₱${base}, Over: ₱${over}, Short: ₱${short} (${terms}w = ₱${weeklyShort.toFixed(2)}/w), Deduct: ₱${deduction}`);
      console.log(`   Base Total (before adj): ₱${baseTotal.toFixed(2)}`);
      console.log(`   Adjustments Delta: ${adjustmentsDelta >= 0 ? '+' : ''}₱${adjustmentsDelta.toFixed(2)}`);
      p.adjustments.forEach((adj, idx) => {
        console.log(`      ${idx + 1}. ${adj.delta >= 0 ? '+' : ''}₱${adj.delta} - ${adj.reason}`);
      });
      console.log(`   Current Total: ₱${currentTotal.toFixed(2)}`);
      console.log(`   Expected Total: ₱${expectedTotal.toFixed(2)}`);
      
      if (Math.abs(currentTotal - expectedTotal) > 0.01) {
        console.log(`   ⚠️  NEEDS FIX! Difference: ₱${(expectedTotal - currentTotal).toFixed(2)}`);
        needsFix++;
      } else {
        console.log(`   ✅ Correct`);
      }
      console.log('');
    }

    console.log(`\n📊 Summary: ${needsFix} payrolls need fixing out of ${payrolls.length}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkAdjustments();
