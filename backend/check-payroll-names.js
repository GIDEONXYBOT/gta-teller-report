import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/rmi_teller_report')
  .then(async () => {
    const db = mongoose.connection.db;
    const payrollCol = db.collection('payrolls');
    
    const names = ['charm', 'missy', 'jenessa', 'shane', 'apple'];
    
    console.log('\n🔍 SEARCHING PAYROLL COLLECTION FOR THESE NAMES:\n');
    
    for (const name of names) {
      const payrolls = await payrollCol.find({ 
        $or: [
          { 'user.name': { $regex: name, $options: 'i' } },
          { tellerName: { $regex: name, $options: 'i' } },
          { name: { $regex: name, $options: 'i' } }
        ]
      }).toArray();
      
      if (payrolls.length > 0) {
        console.log(`✅ ${name.toUpperCase()}: Found ${payrolls.length} payroll record(s)`);
        payrolls.forEach((p, idx) => {
          console.log(`   ${idx + 1}. Date: ${p.date}, Amount: ₱${p.totalPayout || p.amount || 0}, Status: ${p.status}`);
        });
      } else {
        console.log(`❌ ${name.toUpperCase()}: No payroll records found`);
      }
      console.log();
    }
    
    // Show total payroll count
    const totalPayrolls = await payrollCol.countDocuments();
    console.log(`\n📊 Total payroll records in database: ${totalPayrolls}`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
