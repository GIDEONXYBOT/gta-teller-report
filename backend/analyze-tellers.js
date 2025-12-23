import mongoose from 'mongoose';
import User from './models/User.js';

async function analyzeTellers() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');
    console.log('Connected to database');

    const tellers = await User.find({ role: 'teller' }).select('username name _id').sort('username');
    console.log(`Found ${tellers.length} tellers in reporting system:`);
    console.log('=====================================');

    tellers.forEach((teller, i) => {
      console.log(`${i+1}. ${teller.username} - ${teller.name || 'No name'}`);
    });

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeTellers();