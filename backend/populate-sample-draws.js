import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi-teller-report';

// Define Draw model (matching the structure expected by frontend)
const drawSchema = new mongoose.Schema({
  id: Number,
  batch: {
    fightSequence: Number
  },
  result1: {
    type: String,
    enum: ['meron', 'wala', 'draw', 'cancel', 'red', 'blue']
  },
  details: {
    redTotalBetAmount: Number,
    blueTotalBetAmount: Number,
    drawTotalBetAmount: Number
  },
  createdAt: Date
});

const Draw = mongoose.model('Draw', drawSchema);

async function populateSampleDraws() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing draws
    await Draw.deleteMany({});
    console.log('🧹 Cleared existing draws');

    // Create sample draws with realistic results
    const results = ['meron', 'wala', 'draw', 'cancel'];
    const sampleDraws = [];

    for (let i = 1; i <= 120; i++) {
      // Create more realistic result distribution
      let result;
      const rand = Math.random();
      if (rand < 0.45) result = 'meron';      // 45% meron
      else if (rand < 0.90) result = 'wala';  // 45% wala
      else if (rand < 0.95) result = 'draw';  // 5% draw
      else result = 'cancel';                 // 5% cancel

      const draw = {
        id: i,
        batch: {
          fightSequence: i
        },
        result1: result,
        details: {
          redTotalBetAmount: Math.floor(Math.random() * 50000) + 10000,
          blueTotalBetAmount: Math.floor(Math.random() * 50000) + 10000,
          drawTotalBetAmount: Math.floor(Math.random() * 10000) + 1000
        },
        createdAt: new Date(Date.now() - (120 - i) * 60000) // Spread over last 2 hours
      };

      sampleDraws.push(draw);
    }

    await Draw.insertMany(sampleDraws);
    console.log(`✅ Created ${sampleDraws.length} sample draws`);

    // Verify the data
    const count = await Draw.countDocuments();
    const sample = await Draw.find().sort({ id: -1 }).limit(3);

    console.log(`📊 Total draws in database: ${count}`);
    console.log('📋 Sample recent draws:');
    sample.forEach(draw => {
      console.log(`  Fight ${draw.batch?.fightSequence}: ${draw.result1} (${draw.details?.redTotalBetAmount + draw.details?.blueTotalBetAmount} total bets)`);
    });

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

populateSampleDraws();