import mongoose from 'mongoose';

// Connect to local database first to see structure
mongoose.connect('mongodb://localhost:27017/rmi_teller_report')
  .then(async () => {
    const db = mongoose.connection.db;
    const payrollCol = db.collection('payrolls');
    
    const names = ['charm', 'missy', 'jenessa', 'shane', 'apple'];
    
    console.log('\n🔍 SEARCHING PAYROLL FOR BASE SALARY ₱0:\n');
    
    // Search for payroll records with base salary of 0
    const zeroBaseSalaries = await payrollCol.find({ 
      baseSalary: 0 
    }).toArray();
    
    console.log(`Found ${zeroBaseSalaries.length} payroll records with Base Salary = ₱0\n`);
    
    // Filter for our target names
    const targetPayrolls = zeroBaseSalaries.filter(p => {
      const userName = (p.user?.name || p.tellerName || p.name || '').toLowerCase();
      return names.some(name => userName.includes(name));
    });
    
    console.log(`Matching our 5 employees: ${targetPayrolls.length}\n`);
    
    targetPayrolls.forEach(p => {
      const userName = p.user?.name || p.tellerName || p.name || 'Unknown';
      const date = p.date || 'N/A';
      console.log(`✅ ${userName}`);
      console.log(`   📅 Date: ${date}`);
      console.log(`   💰 Current Base: ₱${p.baseSalary || 0}`);
      console.log(`   🔄 Will update to: ₱450\n`);
    });
    
    if (targetPayrolls.length > 0) {
      // Update all matching payrolls
      console.log('🔄 UPDATING BASE SALARIES...\n');
      
      for (const payroll of targetPayrolls) {
        const result = await payrollCol.updateOne(
          { _id: payroll._id },
          { $set: { baseSalary: 450 } }
        );
        
        const userName = payroll.user?.name || payroll.tellerName || payroll.name || 'Unknown';
        if (result.modifiedCount > 0) {
          console.log(`✅ Updated: ${userName} (${payroll.date || 'N/A'})`);
        }
      }
      
      console.log(`\n✅ Total updated: ${targetPayrolls.length} payroll records`);
    } else {
      console.log('❌ No matching payroll records found in local database');
      console.log('Note: These employees might only exist in the production database');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
