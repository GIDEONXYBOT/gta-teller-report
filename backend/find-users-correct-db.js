import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://rmi_admin:rmi1234@rmi-teller-report.fphrmaw.mongodb.net/rmi?retryWrites=true&w=majority&connectTimeoutMS=30000&socketTimeoutMS=30000')
  .then(async () => {
    const db = mongoose.connection.db;
    const usersCol = db.collection('users');
    
    const names = ['charm', 'missy', 'jenessa', 'shane', 'apple', 'keanna'];
    
    console.log('\n🔍 SEARCHING IN CORRECT DATABASE (rmi_teller_report):\n');
    
    for (const name of names) {
      const user = await usersCol.findOne({ name: { $regex: name, $options: 'i' } });
      if (user) {
        console.log(`✅ ${name.toUpperCase()}: FOUND`);
        console.log(`   - Name: ${user.name}`);
        console.log(`   - Role: ${user.role}`);
        console.log(`   - Status: ${user.status || 'active'}`);
        console.log(`   - Base Salary: ₱${user.baseSalary || 0}\n`);
      } else {
        console.log(`❌ ${name.toUpperCase()}: NOT FOUND\n`);
      }
    }
    
    // Show all users
    console.log('📊 ALL USERS IN SYSTEM:\n');
    const allUsers = await usersCol.find().sort({ name: 1 }).toArray();
    
    allUsers.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.name || user.email} (${user.role}) - Salary: ₱${user.baseSalary || 0}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
