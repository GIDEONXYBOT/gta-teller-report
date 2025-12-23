import mongoose from 'mongoose';
import User from './models/User.js';
import fetch from 'node-fetch';

async function debugMatching() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');

    const reportingTellers = await User.find({ role: 'teller', status: 'approved' }).select('username name _id');
    console.log('📊 Reporting tellers:');
    reportingTellers.forEach(t => console.log(`- ${t.username}`));

    const response = await fetch('https://rmi-gideon.gtarena.ph/api/m/secure/report/event', {
      headers: { 'X-TOKEN': 'af9735e1c7857a07f0b078df36842ace' }
    });
    const data = await response.json();
    const bettingTellers = data.data.staffReports || [];
    console.log(`\n🎯 Betting API tellers (${bettingTellers.length}):`);
    bettingTellers.forEach(t => console.log(`- ${t.username}`));

    console.log('\n🔍 Checking matches:');
    for (const bt of bettingTellers.slice(0, 5)) {
      const normalized = bt.username.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
      const match = reportingTellers.find(rt => rt.username === normalized);
      console.log(`${bt.username} -> ${normalized} : ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugMatching();