import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ChickenFightGame from './models/ChickenFightGame.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

async function resetTodayResults() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    
    console.log('✅ Connected to MongoDB');

    // Get today's date (midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log(`🗑️ Resetting results for date: ${today.toISOString().split('T')[0]}`);

    // Find today's game
    const game = await ChickenFightGame.findOne({
      gameDate: { $gte: today, $lt: tomorrow }
    });

    if (!game) {
      console.log('⚠️ No game found for today');
      await mongoose.disconnect();
      return;
    }

    console.log('📊 Current game data:');
    console.log('  Entry Results:', game.entryResults?.length || 0);
    console.log('  Fight Number:', game.fightNumber);
    console.log('  Is Finalized:', game.isFinalized);

    // Reset all results
    game.entryResults = [];
    game.fightNumber = 0;
    game.isFinalized = false;
    game.fights = [];

    await game.save();

    console.log('✅ Today\'s results have been reset!');
    console.log('📊 Updated game data:');
    console.log('  Entry Results:', game.entryResults?.length || 0);
    console.log('  Fight Number:', game.fightNumber);
    console.log('  Is Finalized:', game.isFinalized);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error resetting results:', error);
    process.exit(1);
  }
}

resetTodayResults();
