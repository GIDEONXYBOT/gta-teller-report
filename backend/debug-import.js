import mongoose from 'mongoose';
import User from './models/User.js';
import fetch from 'node-fetch';

async function debugImport() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');
    console.log('✅ Connected to database');

    // Get all existing users
    const allUsers = await User.find({});
    console.log(`\n📊 All users in system (${allUsers.length}):`);
    allUsers.forEach(user => {
      console.log(`- ${user.username}: ${user.name} (${user.role}, ${user.status})`);
    });

    // Fetch betting tellers
    console.log('\n🎯 Fetching tellers from betting API...');
    const response = await fetch('https://rmi-gideon.gtarena.ph/api/m/secure/report/event', {
      method: 'GET',
      headers: {
        'X-TOKEN': 'af9735e1c7857a07f0b078df36842ace',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    const bettingTellers = data.data.staffReports || [];

    console.log(`\n📊 Betting API tellers (${bettingTellers.length}):`);
    bettingTellers.forEach(teller => {
      const normalizedUsername = teller.username.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
      console.log(`- Original: ${teller.username} → Normalized: ${normalizedUsername} (${teller.name})`);
    });

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugImport();