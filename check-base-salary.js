const mongoose = require('mongoose');
const path = require('path');

// Import the User model
const User = require('./backend/models/User.js');

const mongoUrl = process.env.MONGODB_URI || 'mongodb+srv://gideon:gideon123@cluster0.fvx2k.mongodb.net/rmi-teller-report';

mongoose.connect(mongoUrl).then(async () => {
  try {
    const names = ['charm', 'missy', 'keanna', 'jenessa', 'shane', 'apple'];
    
    const users = await User.find({
      $or: names.map(name => ({
        $or: [
          { name: new RegExp(name, 'i') },
          { username: new RegExp(name, 'i') }
        ]
      }))
    }).select('_id name username role baseCapital');
    
    console.log('\n📊 Base Salary Status:\n');
    users.forEach(u => {
      const salary = u.baseCapital || 0;
      const status = salary === 0 ? '❌ NO BASE SALARY' : `✅ ₱${salary.toLocaleString()}`;
      console.log(`${u.name || u.username} (${u.role}): ${status}`);
    });
    
    console.log('\n');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
});
