import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/rmi_teller_report')
  .then(async () => {
    const db = mongoose.connection.db;
    const usersCol = db.collection('users');
    const payrollCol = db.collection('payrolls');
    
    const names = ['charm', 'missy', 'jenessa', 'shane', 'apple'];
    
    console.log('\n🔍 CHECKING EMPLOYEE DETAILS:\n');
    
    for (const name of names) {
      // Check user role
      const user = await usersCol.findOne({ name: { $regex: name, $options: 'i' } });
      
      if (user) {
        console.log(`✅ ${name.toUpperCase()}`);
        console.log(`   📝 Name: ${user.name}`);
        console.log(`   👤 Role: ${user.role}`);
        console.log(`   💼 Status: ${user.status || 'unknown'}`);
        console.log(`   💰 Base Salary: ₱${user.baseSalary || 0}\n`);
      } else {
        // Check in payroll
        const payroll = await payrollCol.findOne({
          $or: [
            { 'user.name': { $regex: name, $options: 'i' } },
            { tellerName: { $regex: name, $options: 'i' } },
            { name: { $regex: name, $options: 'i' } }
          ]
        });
        
        if (payroll) {
          console.log(`⚠️  ${name.toUpperCase()} - NOT in users, but found in payroll`);
          console.log(`   📝 Name: ${payroll.user?.name || payroll.tellerName || payroll.name}`);
          console.log(`   👤 Role: ${payroll.user?.role || 'unknown'}`);
          console.log(`   💰 Base Salary: ₱${payroll.baseSalary || 0}\n`);
        } else {
          console.log(`❌ ${name.toUpperCase()}: NOT FOUND\n`);
        }
      }
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
