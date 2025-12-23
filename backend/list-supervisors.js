import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function listSupervisors() {
  try {
    await mongoose.connect(MONGO_URI);

    const supervisors = await User.find({
      role: { $in: ['supervisor', 'supervisor_teller'] }
    }).select('_id name username role').lean();

    console.log('Supervisors:');
    supervisors.forEach(sup => {
      console.log(`- ${sup.name || sup.username} (ID: ${sup._id})`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

listSupervisors();