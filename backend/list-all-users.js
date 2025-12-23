import mongoose from 'mongoose';
import User from './models/User.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi-teller';

async function listAllUsers() {
  await mongoose.connect(MONGO_URI);
  const users = await User.find({});
  users.forEach(u => {
    console.log(`Name: ${u.name} | Username: ${u.username} | ID: ${u._id}`);
  });
  await mongoose.disconnect();
}

listAllUsers().catch(console.error);
