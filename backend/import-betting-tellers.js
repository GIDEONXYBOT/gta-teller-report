import mongoose from 'mongoose';
import User from './models/User.js';
import fetch from 'node-fetch';
import readline from 'readline';

async function importBettingTellers() {
  try {
    console.log('🚀 Starting Betting Tellers Import Process');
    console.log('==========================================');

    // Connect to database
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');
    console.log('✅ Connected to database\n');

    // Fetch betting tellers
    console.log('🎯 Fetching tellers from betting API...');
    const response = await fetch('https://rmi-gideon.gtarena.ph/api/m/secure/report/event', {
      method: 'GET',
      headers: {
        'X-TOKEN': 'af9735e1c7857a07f0b078df36842ace',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const bettingTellers = data.data.staffReports || [];

    console.log(`📊 Found ${bettingTellers.length} tellers in betting API\n`);

    // Analyze what needs to be imported
    const analysis = {
      toImport: [],
      alreadyExist: [],
      toUpdate: []
    };

    for (const bettingTeller of bettingTellers) {
      const normalizedUsername = bettingTeller.username.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');

      // Check if teller already exists
      const existingTeller = await User.findOne({ username: normalizedUsername });

      if (existingTeller) {
        // Check if name matches
        if (existingTeller.name === bettingTeller.name) {
          analysis.alreadyExist.push({
            username: normalizedUsername,
            name: bettingTeller.name,
            existing: existingTeller
          });
        } else {
          analysis.toUpdate.push({
            username: normalizedUsername,
            currentName: existingTeller.name,
            newName: bettingTeller.name,
            existing: existingTeller
          });
        }
      } else {
        analysis.toImport.push({
          username: normalizedUsername,
          name: bettingTeller.name,
          originalUsername: bettingTeller.username
        });
      }
    }

    // Display analysis
    console.log('📋 IMPORT ANALYSIS:');
    console.log('===================');

    console.log(`\n🆕 Tellers to IMPORT (${analysis.toImport.length}):`);
    console.log('--------------------------------------');
    analysis.toImport.forEach((teller, i) => {
      console.log(`${i+1}. ${teller.username} (${teller.name})`);
      console.log(`   Original betting username: ${teller.originalUsername}`);
    });

    console.log(`\n✅ Tellers that ALREADY EXIST (${analysis.alreadyExist.length}):`);
    console.log('------------------------------------------');
    analysis.alreadyExist.forEach((teller, i) => {
      console.log(`${i+1}. ${teller.username} (${teller.name}) ✓`);
    });

    console.log(`\n🔄 Tellers to UPDATE (${analysis.toUpdate.length}):`);
    console.log('-----------------------------------');
    analysis.toUpdate.forEach((teller, i) => {
      console.log(`${i+1}. ${teller.username}`);
      console.log(`   Current: ${teller.currentName}`);
      console.log(`   New:     ${teller.newName}`);
    });

    if (analysis.toImport.length === 0 && analysis.toUpdate.length === 0) {
      console.log('\n🎉 No action needed - all tellers already exist and are up to date!');
      await mongoose.connection.close();
      return;
    }

    // Ask for confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askConfirmation = (question) => {
      return new Promise((resolve) => {
        rl.question(question, (answer) => {
          resolve(answer.toLowerCase().startsWith('y'));
        });
      });
    };

    console.log('\n⚠️  IMPORT CONFIRMATION REQUIRED');
    console.log('================================');

    let proceedWithImport = false;
    let proceedWithUpdates = false;

    if (analysis.toImport.length > 0) {
      const importConfirm = await askConfirmation(
        `\nImport ${analysis.toImport.length} new tellers? (y/n): `
      );
      proceedWithImport = importConfirm;
    }

    if (analysis.toUpdate.length > 0) {
      const updateConfirm = await askConfirmation(
        `\nUpdate ${analysis.toUpdate.length} existing tellers with new names? (y/n): `
      );
      proceedWithUpdates = updateConfirm;
    }

    rl.close();

    if (!proceedWithImport && !proceedWithUpdates) {
      console.log('\n❌ Import cancelled by user.');
      await mongoose.connection.close();
      return;
    }

    // Proceed with import/update
    let imported = 0;
    let updated = 0;

    if (proceedWithImport) {
      console.log('\n📥 Importing new tellers...');
      for (const teller of analysis.toImport) {
        const newTeller = new User({
          username: teller.username,
          name: teller.name,
          password: '$2a$10$defaultHashedPasswordForImportedTellers', // Default password
          plainTextPassword: 'changeme123', // Default plain text password
          role: 'teller',
          status: 'approved', // Auto-approve imported tellers
          baseSalary: 0, // Will be set later
        });

        await newTeller.save();
        console.log(`✅ Imported: ${teller.username} - ${teller.name}`);
        imported++;
      }
    }

    if (proceedWithUpdates) {
      console.log('\n🔄 Updating existing tellers...');
      for (const teller of analysis.toUpdate) {
        teller.existing.name = teller.newName;
        await teller.existing.save();
        console.log(`✅ Updated: ${teller.username} - ${teller.currentName} → ${teller.newName}`);
        updated++;
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`   Imported: ${imported}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${analysis.alreadyExist.length}`);

    // Show final teller count
    const finalCount = await User.countDocuments({ role: 'teller' });
    console.log(`\n👥 Final teller count in system: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error in import process:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the import process
importBettingTellers();