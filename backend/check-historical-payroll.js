#!/usr/bin/env node

// Check historical payroll records with zero base salary
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const payrollCol = db.collection('payrolls');

    // Find all payroll records with zero or null base salary
    const zeroPayrolls = await payrollCol
      .find({ baseSalary: { $in: [0, null] } })
      .sort({ date: -1 })
      .toArray();

    console.log(`📊 HISTORICAL PAYROLL RECORDS WITH ₱0 BASE SALARY\n`);
    console.log(`Total found: ${zeroPayrolls.length}\n`);

    if (zeroPayrolls.length > 0) {
      // Group by employee
      const byEmployee = {};
      for (const p of zeroPayrolls) {
        const name = p.tellerName || p.name || 'Unknown';
        if (!byEmployee[name]) {
          byEmployee[name] = [];
        }
        byEmployee[name].push(p);
      }

      // Display summary
      console.log('📋 BREAKDOWN BY EMPLOYEE:\n');
      for (const [name, records] of Object.entries(byEmployee).sort()) {
        const dates = records.map(r => r.date).join(', ');
        console.log(`${name.toUpperCase()} (${records.length} records):`);
        console.log(`  Dates: ${dates}\n`);
      }

      // Display first 10 records
      console.log('\n🔍 SAMPLE RECORDS (first 10):');
      for (let i = 0; i < Math.min(10, zeroPayrolls.length); i++) {
        const p = zeroPayrolls[i];
        console.log(`  ${i + 1}. ${p.tellerName || p.name} - ${p.date}: Base ₱${p.baseSalary || 0}`);
      }
    } else {
      console.log('✅ NO HISTORICAL PAYROLL RECORDS WITH ₱0 BASE SALARY FOUND!');
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
