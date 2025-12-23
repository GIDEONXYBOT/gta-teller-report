import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

dotenv.config();

async function generateSummaryTable() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const startDate = new Date('2025-11-10T00:00:00Z');
    const endDate = new Date('2025-11-17T00:00:00Z');

    const payrolls = await Payroll.find({
      createdAt: { $gte: startDate, $lt: endDate }
    }).populate('user', 'username name').sort({ user: 1, createdAt: 1 }).lean();

    console.log('📊 WEEKLY PAYROLL SUMMARY (Nov 10-16, 2025)\n');
    console.log('='.repeat(120));

    const groupedByUser = {};
    
    payrolls.forEach(payroll => {
      const userName = payroll.user?.username || payroll.user?.name || 'Unknown';
      if (!groupedByUser[userName]) {
        groupedByUser[userName] = [];
      }
      groupedByUser[userName].push(payroll);
    });

    // Calculate totals for each user
    const userTotals = {};
    for (const [userName, userPayrolls] of Object.entries(groupedByUser).sort()) {
      let weeklyTotal = 0;
      let dailyDetails = [];

      userPayrolls.forEach(payroll => {
        const date = new Date(payroll.createdAt).toISOString().split('T')[0];
        const netOver = payroll.over - payroll.short;
        weeklyTotal += payroll.totalSalary;
        dailyDetails.push({
          date,
          base: payroll.baseSalary,
          over: payroll.over,
          short: payroll.short,
          netOver,
          total: payroll.totalSalary
        });
      });

      userTotals[userName] = {
        dailyDetails,
        weeklyTotal,
        daysWorked: userPayrolls.length
      };
    }

    // Print table
    console.log(
      'NAME'.padEnd(20) + 
      'BASE'.padStart(8) + 
      'OVER'.padStart(8) + 
      'BASE'.padStart(8) + 
      'OVER'.padStart(8) + 
      'BASE'.padStart(8) + 
      'OVER'.padStart(8) + 
      'BASE'.padStart(8) + 
      'OVER'.padStart(8) + 
      'TOTAL'.padStart(10)
    );
    console.log('='.repeat(120));

    for (const [userName, data] of Object.entries(userTotals).sort()) {
      let line = userName.toUpperCase().padEnd(20);
      
      // Add up to 4 days of data
      for (let i = 0; i < 4; i++) {
        if (data.dailyDetails[i]) {
          const day = data.dailyDetails[i];
          line += String(day.base).padStart(8);
          line += String(day.netOver).padStart(8);
        } else {
          line += ''.padStart(16);
        }
      }
      
      line += String(data.weeklyTotal).padStart(10);
      console.log(line);
    }

    console.log('='.repeat(120));
    console.log(`\nTotal Tellers: ${Object.keys(userTotals).length}`);
    console.log(`Total Payrolls: ${payrolls.length}`);

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateSummaryTable();
