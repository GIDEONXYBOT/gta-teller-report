#!/usr/bin/env node
/**
 * UPDATE BASE SALARIES FOR PRODUCTION PAYROLL
 * Run this script on the production server: node update-production-payroll.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env file');
  process.exit(1);
}

console.log('🔄 Connecting to production database...\n');

mongoose.connect(MONGO_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    const payrollCol = db.collection('payrolls');
    const usersCol = db.collection('users');
    
    // Target employees that need base salary update
    const targetNames = ['charm', 'missy', 'jenessa', 'shane', 'apple'];
    
    // Conditional salaries for specific employees
    // Apple: ₱600 (supervisor, sometimes works as teller)
    const conditionalSalaries = {
      apple: 600  // Supervisor base salary (primary role)
    };
    
    console.log('🔍 FINDING PAYROLL RECORDS WITH BASE SALARY = ₱0:\n');
    
    // Find all payroll records with baseSalary = 0
    const zeroBaseSalaries = await payrollCol.find({ 
      baseSalary: { $in: [0, null, undefined] }
    }).toArray();
    
    console.log(`Found ${zeroBaseSalaries.length} payroll records with Base Salary = ₱0\n`);
    
    // Filter for our target names
    const targetPayrolls = zeroBaseSalaries.filter(p => {
      const userName = (p.user?.name || p.tellerName || p.name || '').toLowerCase();
      return targetNames.some(name => userName.includes(name));
    });
    
    console.log(`📊 Matching target employees: ${targetPayrolls.length}\n`);
    
    if (targetPayrolls.length === 0) {
      console.log('ℹ️  No payroll records found with Base Salary = ₱0');
      console.log('\n🔄 Searching for any payroll records for these employees...\n');
      
      // If no zero-base records, search for any records
      for (const name of targetNames) {
        const matching = await payrollCol.find({
          $or: [
            { 'user.name': { $regex: name, $options: 'i' } },
            { tellerName: { $regex: name, $options: 'i' } },
            { name: { $regex: name, $options: 'i' } }
          ]
        }).sort({ date: -1 }).limit(1).toArray();
        
        if (matching.length > 0) {
          const p = matching[0];
          const userName = p.user?.name || p.tellerName || p.name || 'Unknown';
          console.log(`✅ ${name.toUpperCase()}: Found`);
          console.log(`   📝 Name: ${userName}`);
          console.log(`   💰 Current Base: ₱${p.baseSalary || 0}`);
          console.log(`   📅 Latest Date: ${p.date || 'N/A'}\n`);
        }
      }
      
      process.exit(0);
    }
    
    // Show records to be updated
    console.log('📋 PAYROLL RECORDS TO UPDATE:\n');
    targetPayrolls.forEach((p, idx) => {
      const userName = p.user?.name || p.tellerName || p.name || 'Unknown';
      console.log(`${idx + 1}. ${userName}`);
      console.log(`   📅 Date: ${p.date || 'N/A'}`);
      console.log(`   💰 Current Base: ₱${p.baseSalary || 0} → ₱450`);
      console.log();
    });
    
    // Update payrolls
    let updatedCount = 0;
    for (const payroll of targetPayrolls) {
      try {
        // Determine the salary for this employee
        let newBaseSalary = 450;
        const employeeName = (payroll.user?.name || payroll.tellerName || payroll.name || '').toLowerCase();
        
        // Check if this employee has a conditional salary
        for (const [targetName, conditionalAmount] of Object.entries(conditionalSalaries)) {
          if (employeeName.includes(targetName.toLowerCase())) {
            newBaseSalary = conditionalAmount;
            console.log(`   📝 ${employeeName} matched conditional rule: ₱${conditionalAmount}`);
            break;
          }
        }

        const result = await payrollCol.updateOne(
          { _id: payroll._id },
          { $set: { baseSalary: newBaseSalary, updatedAt: new Date() } }
        );
        
        const userName = payroll.user?.name || payroll.tellerName || payroll.name || 'Unknown';
        if (result.modifiedCount > 0) {
          updatedCount++;
          console.log(`✅ ${userName} (${payroll.date || 'N/A'}) → ₱${newBaseSalary}`);
        }
      } catch (err) {
        console.error(`❌ Error updating payroll:`, err.message);
      }
    }
    
    console.log(`\n✅ COMPLETED: Updated ${updatedCount} payroll records`);
    console.log(`💾 Total records processed: ${targetPayrolls.length}`);
    
    // Also update users base salary if they're tellers
    console.log('\n🔄 UPDATING USER BASE SALARIES...\n');
    
    let userUpdatedCount = 0;
    for (const name of targetNames) {
      const user = await usersCol.findOne({
        name: { $regex: name, $options: 'i' }
      });
      
      if (user) {
        // Determine salary for this user
        let newBaseSalary = 450;
        for (const [targetName, conditionalAmount] of Object.entries(conditionalSalaries)) {
          if (user.name.toLowerCase().includes(targetName.toLowerCase())) {
            newBaseSalary = conditionalAmount;
            break;
          }
        }

        if (user.baseSalary !== newBaseSalary) {
          await usersCol.updateOne(
            { _id: user._id },
            { $set: { baseSalary: newBaseSalary } }
          );
          userUpdatedCount++;
          console.log(`✅ User: ${user.name} → Base Salary: ₱${newBaseSalary}`);
        } else {
          console.log(`ℹ️  User: ${user.name} → Already has Base Salary: ₱${newBaseSalary}`);
        }
      } else {
        console.log(`ℹ️  User: ${name} → Not found in users collection`);
      }
    }
    
    console.log(`\n✅ FINAL SUMMARY:`);
    console.log(`   📋 Payroll records updated: ${updatedCount}`);
    console.log(`   👤 User records updated: ${userUpdatedCount}`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  });
