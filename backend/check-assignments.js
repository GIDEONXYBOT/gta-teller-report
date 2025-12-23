import mongoose from 'mongoose';
import User from './models/User.js';

async function checkAssignments() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');
    const tellers = await User.find({ role: { $in: ['teller', 'supervisor_teller'] } }).select('username name supervisorId').lean();
    console.log('Teller assignments:');
    tellers.forEach(t => console.log('  -', t.username, '-> supervisorId:', t.supervisorId));

    const supervisors = await User.find({ role: 'supervisor' }).select('_id username').lean();
    console.log('Supervisors:');
    supervisors.forEach(s => console.log('  -', s._id, s.username));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkAssignments();