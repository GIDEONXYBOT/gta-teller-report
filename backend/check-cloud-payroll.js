import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://rmi_admin:rmi1234@rmi-teller-report.fphrmaw.mongodb.net/rmi?retryWrites=true&w=majority&connectTimeoutMS=30000&socketTimeoutMS=30000';

mongoose.connect(MONGO_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    const payrollCol = db.collection('payrolls');
    const usersCol = db.collection('users');
    
    console.log('\n🌐 CHECKING CLOUD DATABASE (MongoDB Atlas):\n');
    
    const names = ['charm', 'missy', 'jenessa', 'shane', 'apple', 'keanna'];
    
    // First check users
    console.log('📋 USERS IN CLOUD DATABASE:\n');
    for (const name of names) {
      const user = await usersCol.findOne({ name: { $regex: name, $options: 'i' } });
      if (user) {
        console.log(`✅ ${name}: FOUND (${user.role}) - Base Salary: ₱${user.baseSalary || 0}`);
      } else {
        console.log(`❌ ${name}: NOT FOUND`);
      }
    }
    
    // Then check payrolls
    console.log('\n💰 PAYROLL RECORDS IN CLOUD DATABASE:\n');
    for (const name of names) {
      const payrolls = await payrollCol.find({ 
        $or: [
          { 'user.name': { $regex: name, $options: 'i' } },
          { tellerName: { $regex: name, $options: 'i' } },
          { name: { $regex: name, $options: 'i' } }
        ]
      }).sort({ date: -1 }).limit(3).toArray();
      
      if (payrolls.length > 0) {
        console.log(`✅ ${name.toUpperCase()}: ${payrolls.length} payroll record(s)`);
        payrolls.forEach((p) => {
          console.log(`   📅 ${p.date || 'N/A'} | Amount: ₱${p.totalPayout || p.amount || 0} | Base: ₱${p.baseSalary || 0}`);
        });
      } else {
        console.log(`❌ ${name.toUpperCase()}: No payroll records found`);
      }
      console.log();
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Connection error:', err.message);
    process.exit(1);
  });
