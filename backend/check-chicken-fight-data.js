import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ChickenFightGame from './models/ChickenFightGame.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function checkData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    
    console.log('✅ Connected to MongoDB');

    // Check all games in the database
    const allGames = await ChickenFightGame.find({}).sort({ gameDate: -1 }).limit(10);

    console.log(`\n📊 Total Chicken Fight Games: ${allGames.length}\n`);

    if (allGames.length === 0) {
      console.log('❌ No chicken fight games found in database');
      await mongoose.disconnect();
      return;
    }

    allGames.forEach((game, idx) => {
      const dateStr = new Date(game.gameDate).toISOString().split('T')[0];
      console.log(`\n[${idx + 1}] Date: ${dateStr}`);
      console.log(`    Entry Results: ${game.entryResults?.length || 0}`);
      console.log(`    Fight Number: ${game.fightNumber}`);
      console.log(`    Is Finalized: ${game.isFinalized}`);
      
      if (game.entryResults?.length > 0) {
        game.entryResults.forEach((entry, i) => {
          console.log(`    [${i + 1}] ${entry.entryName} (${entry.gameType})`);
          console.log(`        Status: ${entry.status}, Prize: ${entry.prize}`);
          console.log(`        Legs: ${entry.legResults?.length || 0}`);
          entry.legResults?.forEach(leg => {
            console.log(`          - Leg #${leg.legNumber}: ${leg.result}`);
          });
        });
      }
    });

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error checking data:', error);
    process.exit(1);
  }
}

checkData();
