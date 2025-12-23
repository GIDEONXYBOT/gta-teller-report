import mongoose from 'mongoose';
import User from './models/User.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi-teller';

async function findUsers() {
  await mongoose.connect(MONGO_URI);
  const users = await User.find({
    $or: [
      { name: /keanna|erika/i },
      { username: /keanna|erika/i }
    ]
  });
  users.forEach(u => {
    console.log(`Found: ${u.name} | Username: ${u.username} | ID: ${u._id}`);
  });
  await mongoose.disconnect();
}

findUsers().catch(console.error);
