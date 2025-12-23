// Test supervisor teller-management endpoint for today's data
import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const API_URL = 'http://localhost:5000';

async function testSupervisorEndpoint() {
  // Get a real supervisor ID from database
  await mongoose.connect(process.env.MONGO_URI);
  const supervisor = await User.findOne({ role: 'supervisor' }).lean();
  if (!supervisor) {
    console.log('❌ No supervisor found in database');
    await mongoose.disconnect();
    return;
  }
  const SUPERVISOR_ID = supervisor._id.toString();
  console.log(`Using supervisor: ${supervisor.name} (${SUPERVISOR_ID})\n`);
  await mongoose.disconnect();
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Testing supervisor teller list for date: ${today}\n`);
    
    const response = await axios.get(`${API_URL}/api/teller-management/tellers`, {
      params: {
        supervisorId: SUPERVISOR_ID,
        dateKey: today
      }
    });

    const tellers = response.data;
    console.log(`✅ Found ${tellers.length} tellers with activity today\n`);

    tellers.forEach((t, idx) => {
      console.log(`${idx + 1}. ${t.name}`);
      console.log(`   Base Capital: ₱${t.baseCapital?.toLocaleString() || 0}`);
      console.log(`   Additional: ₱${t.additionalCapital?.toLocaleString() || 0}`);
      console.log(`   Remitted: ₱${t.remitted?.toLocaleString() || 0}`);
      console.log(`   Balance: ₱${t.balance?.toLocaleString() || 0}`);
      console.log(`   Has Transactions Today: ${t.hasTransactionsToday}`);
      console.log(`   Capital Created Today: ${t.capitalCreatedToday}`);
      console.log(`   Capital Status: ${t.activeCapital?.status || 'none'}`);
      console.log('');
    });

    console.log('\n✅ Endpoint test complete');
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
  }
}

testSupervisorEndpoint();
