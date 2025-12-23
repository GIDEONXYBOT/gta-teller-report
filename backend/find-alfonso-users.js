import mongoose from 'mongoose';
import User from './models/User.js';

async function findUsersWithAlfonso() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');

    // Find all users
    const allUsers = await User.find({}).select('name username role').lean();

    console.log(`Found ${allUsers.length} users total:`);
    allUsers.forEach(user => {
      console.log(`- ${user.name || user.username} (${user.role})`);
    });

    // Search for alfonso in names/usernames
    const alfonsoUsers = allUsers.filter(user =>
      (user.name && user.name.toLowerCase().includes('alfonso')) ||
      (user.username && user.username.toLowerCase().includes('alfonso'))
    );

    console.log(`\nUsers containing 'alfonso': ${alfonsoUsers.length}`);
    alfonsoUsers.forEach(user => {
      console.log(`- ${user.name || user.username} (${user.role}) - ID: ${user._id}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

findUsersWithAlfonso();