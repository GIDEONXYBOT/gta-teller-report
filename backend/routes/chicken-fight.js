import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import ChickenFightEntry from '../models/ChickenFightEntry.js';
import ChickenFightBet from '../models/ChickenFightBet.js';
import ChickenFightGame from '../models/ChickenFightGame.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// ============ ENTRY ENDPOINTS ============

// Create new entry
router.post('/entries', async (req, res) => {
  try {
    const { entryName, gameType, legBandNumbers, legBandDetails } = req.body;

    // Validate input
    if (!entryName || !gameType || !legBandNumbers) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!['2wins', '3wins'].includes(gameType)) {
      return res.status(400).json({ success: false, message: 'Invalid game type' });
    }

    const expectedLegCount = gameType === '2wins' ? 2 : 3;
    if (legBandNumbers.length !== expectedLegCount) {
      return res.status(400).json({
        success: false,
        message: `${gameType} requires ${expectedLegCount} leg band numbers`
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build legBandDetails if provided
    const details = legBandDetails && legBandDetails.length > 0
      ? legBandDetails
      : legBandNumbers.map(band => ({
          legBand: band,
          featherType: 'Unknown'
        }));

    const entry = new ChickenFightEntry({
      entryName,
      gameType,
      legBandNumbers,
      legBandDetails: details,
      createdBy: req.user._id,
      createdByName: req.user.name,
      gameDate: today
    });

    await entry.save();

    // 🔄 Emit socket event for new entry
    if (req.app.io) {
      req.app.io.of('/chicken-fight').emit('entriesUpdated', {
        gameDate: today.toISOString().split('T')[0],
        type: 'entry_created',
        entry
      });
    }

    res.json({
      success: true,
      message: 'Entry created successfully',
      entry
    });
  } catch (error) {
    console.error('Error creating entry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all entries for today
router.get('/entries', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entries = await ChickenFightEntry.find({
      gameDate: { $gte: today, $lt: tomorrow },
      isActive: true
    }).sort({ gameType: 1, createdAt: -1 });

    res.json({
      success: true,
      entries
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete an entry
router.delete('/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await ChickenFightEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    // Soft delete - mark as inactive
    entry.isActive = false;
    entry.deletedBy = req.user._id;
    entry.deletedAt = new Date();
    await entry.save();

    res.json({
      success: true,
      message: 'Entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting entry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update entry
router.put('/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { entryName, legBandNumbers, legBandDetails } = req.body;

    const entry = await ChickenFightEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    if (entryName) entry.entryName = entryName;

    if (legBandNumbers) {
      const expectedLegCount = entry.gameType === '2wins' ? 2 : 3;
      if (legBandNumbers.length !== expectedLegCount) {
        return res.status(400).json({
          success: false,
          message: `${entry.gameType} requires ${expectedLegCount} leg band numbers`
        });
      }
      entry.legBandNumbers = legBandNumbers;
    }

    if (legBandDetails && legBandDetails.length > 0) {
      entry.legBandDetails = legBandDetails;
    }

    await entry.save();

    res.json({
      success: true,
      message: 'Entry updated successfully',
      entry
    });
  } catch (error) {
    console.error('Error updating entry:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ BET ENDPOINTS ============

// Place a bet
router.post('/bets', async (req, res) => {
  try {
    const { gameDate, gameType, entryId, side, amount } = req.body;

    if (!gameDate || !gameType || !entryId || !side || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!['meron', 'wala'].includes(side)) {
      return res.status(400).json({ success: false, message: 'Invalid side' });
    }

    // Verify entry exists
    const entry = await ChickenFightEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    const bet = new ChickenFightBet({
      gameDate: new Date(gameDate),
      gameType,
      entryId,
      entryName: entry.entryName,
      side,
      amount,
      createdBy: req.user._id,
      createdByName: req.user.name
    });

    await bet.save();

    res.json({
      success: true,
      message: 'Bet placed successfully',
      bet
    });
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get bets for a specific date and game type
router.get('/bets', async (req, res) => {
  try {
    const { gameDate, gameType } = req.query;

    if (!gameDate) {
      return res.status(400).json({ success: false, message: 'gameDate is required' });
    }

    const startDate = new Date(gameDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const query = {
      gameDate: { $gte: startDate, $lt: endDate }
    };

    if (gameType && gameType !== 'all') {
      query.gameType = gameType;
    }

    const bets = await ChickenFightBet.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      bets
    });
  } catch (error) {
    console.error('Error fetching bets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ GAME RESULTS ENDPOINTS ============

// Set game selection for the day
router.post('/game/daily-selection', async (req, res) => {
  try {
    const { gameTypes } = req.body;

    if (!gameTypes || !Array.isArray(gameTypes) || gameTypes.length === 0) {
      return res.status(400).json({ success: false, message: 'gameTypes array is required' });
    }

    const validTypes = gameTypes.every(t => ['2wins', '3wins'].includes(t));
    if (!validTypes) {
      return res.status(400).json({ success: false, message: 'Invalid game types' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let game = await ChickenFightGame.findOne({ gameDate: today });

    if (game) {
      game.gameTypes = gameTypes;
      await game.save();
    } else {
      game = new ChickenFightGame({
        gameDate: today,
        gameTypes,
        createdBy: req.user._id
      });
      await game.save();
    }

    res.json({
      success: true,
      message: 'Game selection updated',
      game
    });
  } catch (error) {
    console.error('Error setting game selection:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get today's game selection
router.get('/game/daily-selection', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const game = await ChickenFightGame.findOne({ gameDate: today });

    res.json({
      success: true,
      game: game || { gameTypes: [] }
    });
  } catch (error) {
    console.error('Error fetching game selection:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Set results and determine winners (Champion/Insurance)
router.put('/game/results', async (req, res) => {
  try {
    const { gameDate, entryResults } = req.body;

    if (!gameDate || !entryResults) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const gameDateObj = new Date(gameDate);
    gameDateObj.setHours(0, 0, 0, 0);

    let game = await ChickenFightGame.findOne({ gameDate: gameDateObj });

    if (!game) {
      game = new ChickenFightGame({
        gameDate: gameDateObj,
        gameTypes: [],
        createdBy: req.user._id
      });
    }

    console.log('📊 Processing entry results:', JSON.stringify(entryResults, null, 2));

    // Process each entry result
    const processedResults = entryResults.map(result => {
      const { entryId, entryName, gameType, legResults } = result;

      // Determine status based on legResults
      let status = 'none';
      let prize = 0;

      if (gameType === '2wins') {
        const allWins = legResults.every(leg => leg.result === 'win');
        if (allWins) {
          status = 'champion';
          prize = 5000;
        }
        // 2-Wins: No insurance, only champion status
      } else if (gameType === '3wins') {
        const allWins = legResults.every(leg => leg.result === 'win');
        const winCount = legResults.filter(leg => leg.result === 'win').length;
        const noRecordCount = legResults.filter(leg => leg.result === 'noRecord').length;

        if (allWins) {
          status = 'champion';
          prize = 20000;
        } else if (winCount === 2 && noRecordCount === 1) {
          status = 'insurance';
          prize = 5000;
        }
      }

      return {
        entryId,
        entryName,
        gameType,
        legResults,
        status,
        prize
      };
    });

    console.log('✅ Processed results:', JSON.stringify(processedResults, null, 2));

    game.entryResults = processedResults;
    game.isFinalized = true;
    const savedGame = await game.save();

    console.log('💾 Game results saved to database:', {
      gameDate: gameDateObj.toISOString().split('T')[0],
      entryResults: processedResults.length,
      isFinalized: true
    });

    // 🔄 Emit socket event for results to all users in this date's room
    if (req.app.io) {
      const gameDate = gameDateObj.toISOString().split('T')[0];
      const eventData = {
        gameDate,
        entryResults: processedResults,
        isFinalized: true,
        updatedAt: new Date().toISOString()
      };
      
      req.app.io.of('/chicken-fight').to(`fights-${gameDate}`).emit('resultsRecorded', eventData);
      console.log(`📡 Results socket event emitted to fights-${gameDate} room`, eventData);
    } else {
      console.warn('⚠️ Socket.IO not available for emitting results event');
    }

    // Update bets with payouts
    for (const result of processedResults) {
      if (result.status === 'champion' || result.status === 'insurance') {
        await ChickenFightBet.updateMany(
          {
            gameDate: gameDateObj,
            entryId: result.entryId,
            side: 'meron'
          },
          {
            result: 'win',
            payout: result.prize
          }
        );

        await ChickenFightBet.updateMany(
          {
            gameDate: gameDateObj,
            entryId: result.entryId,
            side: 'wala'
          },
          {
            result: 'loss',
            payout: 0
          }
        );
      }
    }

    res.json({
      success: true,
      message: 'Results finalized',
      game
    });
  } catch (error) {
    console.error('Error setting results:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get game results for a date
router.get('/game/results', async (req, res) => {
  try {
    const { gameDate } = req.query;

    if (!gameDate) {
      return res.status(400).json({ success: false, message: 'gameDate is required' });
    }

    const gameDateObj = new Date(gameDate);
    gameDateObj.setHours(0, 0, 0, 0);

    const game = await ChickenFightGame.findOne({ gameDate: gameDateObj });

    res.json({
      success: true,
      game: game || { entryResults: [], isFinalized: false }
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save fight results for today
router.post('/fights/save', async (req, res) => {
  try {
    const { fights, fightNumber } = req.body;

    if (!Array.isArray(fights)) {
      return res.status(400).json({ success: false, message: 'fights array is required' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let game = await ChickenFightGame.findOne({ gameDate: today });

    if (!game) {
      game = new ChickenFightGame({
        gameDate: today,
        createdBy: req.user._id,
        fights: fights,
        fightNumber: fightNumber || 0
      });
    } else {
      game.fights = fights;
      game.fightNumber = fightNumber || 0;
      game.lastUpdatedBy = req.user._id;
      game.lastUpdatedAt = new Date();
    }

    await game.save();

    // 🔄 Emit socket event to notify all clients
    if (req.app.io) {
      const gameDate = today.toISOString().split('T')[0];
      req.app.io.of('/chicken-fight').to(`fights-${gameDate}`).emit('fightsUpdated', {
        gameDate,
        fights,
        fightNumber
      });
      console.log(`📡 Socket event emitted to fights-${gameDate} room`);
    }

    res.json({
      success: true,
      message: 'Fights saved successfully',
      game
    });
  } catch (error) {
    console.error('Error saving fights:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get fight results for today
router.get('/fights/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const game = await ChickenFightGame.findOne({ gameDate: today });

    res.json({
      success: true,
      fights: game?.fights || [],
      fightNumber: game?.fightNumber || 0,
      game
    });
  } catch (error) {
    console.error('Error fetching fights:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get fight results for a specific date
router.get('/fights/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const startDate = new Date(`${date}T00:00:00Z`);
    const endDate = new Date(`${date}T23:59:59Z`);

    const game = await ChickenFightGame.findOne({
      gameDate: { $gte: startDate, $lte: endDate }
    });

    res.json({
      success: true,
      fights: game?.fights || [],
      fightNumber: game?.fightNumber || 0,
      game
    });
  } catch (error) {
    console.error('Error fetching fights for date:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
