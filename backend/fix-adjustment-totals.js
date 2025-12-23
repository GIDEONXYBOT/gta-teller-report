import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixAdjustmentTotals() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all payrolls with adjustments
    const payrolls = await Payroll.find({
      adjustments: { $exists: true, $ne: [] }
    });

    console.log(`📦 Found ${payrolls.length} payrolls with adjustments\n`);

    let fixed = 0;
    
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
      
      if (Math.abs(currentTotal - expectedTotal) > 0.01) {
        console.log(`🔧 Fixing payroll ID: ${p._id}`);
        console.log(`   Date: ${new Date(p.createdAt || p.date).toLocaleDateString()}`);
        console.log(`   Base Total: ₱${baseTotal.toFixed(2)}`);
        console.log(`   Adjustments Delta: ${adjustmentsDelta >= 0 ? '+' : ''}₱${adjustmentsDelta.toFixed(2)}`);
        console.log(`   Old Total: ₱${currentTotal.toFixed(2)} → New Total: ₱${expectedTotal.toFixed(2)}`);
        
        p.totalSalary = expectedTotal;
        await p.save();
        fixed++;
        console.log(`   ✅ Fixed!\n`);
      }
    }

    console.log(`\n📊 Summary: Fixed ${fixed} payrolls out of ${payrolls.length}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

fixAdjustmentTotals();
