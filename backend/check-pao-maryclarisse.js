import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Search for users with names containing "pao" or "mary clarisse"
    const payrolls = await Payroll.find({});
    
    const paoPayrolls = payrolls.filter(p => {
      const userId = p.user?.toString() || p.user;
      // We'll check by user ID later, first let's get all payrolls
      return false; // Will filter after getting user names
    });
    
    console.log(`📦 Found ${payrolls.length} total payrolls\n`);
    
    // Group by user ID
    const userPayrolls = {};
    for (const p of payrolls) {
      const userId = p.user?.toString() || p.user;
      if (!userPayrolls[userId]) {
        userPayrolls[userId] = [];
      }
      userPayrolls[userId].push(p);
    }
    
    console.log(`👥 Found ${Object.keys(userPayrolls).length} unique users\n`);
    
    // Check each user's payrolls
    for (const [userId, userPayrollsList] of Object.entries(userPayrolls)) {
      const firstPayroll = userPayrollsList[0];
      
      console.log(`\n👤 User ID: ${userId}`);
      console.log(`📊 Total payrolls: ${userPayrollsList.length}\n`);
      
      for (const p of userPayrollsList) {
        console.log(`   Date: ${new Date(p.createdAt || p.date).toLocaleDateString()}`);
        console.log(`   ID: ${p._id}`);
        console.log(`   Base: ₱${p.baseSalary}, Over: ₱${p.over}, Short: ₱${p.short}, Deduction: ₱${p.deduction}`);
        console.log(`   Short Payment Terms: ${p.shortPaymentTerms || 1} weeks`);
        console.log(`   Current Total: ₱${p.totalSalary}`);
        
        // Calculate expected total
        const terms = p.shortPaymentTerms || 1;
        const weeklyShort = p.short / terms;
        const expectedTotal = p.baseSalary + p.over - weeklyShort - p.deduction;
        
        console.log(`   Expected Total: ₱${expectedTotal.toFixed(2)} (Short: ₱${p.short} / ${terms} weeks = ₱${weeklyShort.toFixed(2)}/week)`);
        
        if (Math.abs(p.totalSalary - expectedTotal) > 0.01) {
          console.log(`   ⚠️  MISMATCH! Difference: ₱${(expectedTotal - p.totalSalary).toFixed(2)}`);
        } else {
          console.log(`   ✅ Total is correct`);
        }
        
        if (p.adjustments && p.adjustments.length > 0) {
          console.log(`   Adjustments: ${p.adjustments.length}`);
          p.adjustments.forEach((adj, idx) => {
            console.log(`     ${idx + 1}. Delta: ₱${adj.delta}, Reason: ${adj.reason}`);
          });
        }
        console.log('');
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkUsers();
