// backend/routes/draws.js - Manage draw results
import express from 'express';
import mongoose from 'mongoose';
// import { requireAuth } from '../middleware/auth.js'; // Removed for public access

const router = express.Router();

// Remove auth middleware for public access to draw results
// router.use(requireAuth);

/**
 * GET /api/draws
 * Get all draw results sorted by fight number
 */
router.get('/', async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, returning sample data');
      return res.json({
        success: true,
        data: generateSampleDraws(),
        totalDraws: 120,
        message: 'Using sample data - database not connected'
      });
    }

    // Query the draws collection directly using mongoose
    let draws = [];
    try {
      draws = await mongoose.connection.db.collection('draws')
        .find({})
        .sort({ id: 1 }) // Sort by numeric id field (1, 2, 3...)
        .limit(360) // Limit to reasonable amount for display
        .toArray();
    } catch (dbError) {
      console.log('⚠️ Database query failed, returning sample data:', dbError.message);
      return res.json({
        success: true,
        data: generateSampleDraws(),
        totalDraws: 120,
        message: 'Using sample data - database query failed'
      });
    }

    // If no draws found in database, return sample data
    if (!draws || draws.length === 0) {
      console.log('⚠️ No draws found in database, returning sample data');
      return res.json({
        success: true,
        data: generateSampleDraws(),
        totalDraws: 120,
        message: 'Using sample data - no data in database'
      });
    }

    console.log(`✅ Fetched ${draws.length} draws from database`);

    res.json({
      success: true,
      data: draws,
      totalDraws: draws.length
    });

  } catch (err) {
    console.error('❌ Error fetching draws:', err);
    // Return sample data as fallback
    res.json({
      success: true,
      data: generateSampleDraws(),
      totalDraws: 120,
      message: 'Using sample data - error occurred'
    });
  }
});

/**
 * GET /api/draws/current
 * Get the current/latest draw
 */
router.get('/current', async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, returning sample current draw');
      const sampleDraws = generateSampleDraws();
      return res.json({
        success: true,
        data: sampleDraws[sampleDraws.length - 1] || null
      });
    }

    let currentDraw = [];
    try {
      currentDraw = await mongoose.connection.db.collection('draws')
        .find({})
        .sort({ id: -1 }) // Sort by numeric id descending (newest first)
        .limit(1)
        .toArray();
    } catch (dbError) {
      console.log('⚠️ Database query failed for current draw, returning sample data:', dbError.message);
      const sampleDraws = generateSampleDraws();
      return res.json({
        success: true,
        data: sampleDraws[sampleDraws.length - 1] || null
      });
    }

    // If no current draw found, return sample data
    if (!currentDraw || currentDraw.length === 0) {
      console.log('⚠️ No current draw found in database, returning sample data');
      const sampleDraws = generateSampleDraws();
      return res.json({
        success: true,
        data: sampleDraws[sampleDraws.length - 1] || null
      });
    }

    res.json({
      success: true,
      data: currentDraw[0] || null
    });

  } catch (err) {
    console.error('❌ Error fetching current draw:', err);
    // Return sample data as fallback
    const sampleDraws = generateSampleDraws();
    res.json({
      success: true,
      data: sampleDraws[sampleDraws.length - 1] || null
    });
  }
});

/**
 * Generate sample draws data for fallback
 */
function generateSampleDraws() {
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

  return sampleDraws;
}

export default router;