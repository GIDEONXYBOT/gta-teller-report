import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import ChickenFightEntry from '../models/ChickenFightEntry.js';
import ChickenFightRegistration from '../models/ChickenFightRegistration.js';
import { DateTime } from 'luxon';

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// ============ REGISTRATION ENDPOINTS ============

// Get all registrations for a specific date
router.get('/registrations', async (req, res) => {
  try {
    const { gameDate } = req.query;
    
    if (!gameDate) {
      return res.status(400).json({ success: false, message: 'gameDate is required' });
    }

    console.log(`🔍 Fetching registrations for date: ${gameDate}`);

    // Parse date properly - gameDate should be in YYYY-MM-DD format
    const [year, month, day] = gameDate.split('-');
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const registrations = await ChickenFightRegistration.find({
      gameDate: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ createdAt: -1 });

    console.log(`✅ Found ${registrations.length} registrations`);
    registrations.forEach((reg, i) => {
      console.log(`Registration ${i}: ${reg.entryName}, registrations:`, reg.registrations);
    });

    res.json({
      success: true,
      registrations,
      count: registrations.length
    });
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// Register an entry (create registration record)
router.post('/registrations', async (req, res) => {
  try {
    const { entryId, entryName, gameTypes, registrations, gameDate } = req.body;
    const username = req.user.username;

    console.log('Backend received registration request:', JSON.stringify({
      entryId,
      entryName,
      gameTypes,
      registrations,
      gameDate
    }, null, 2));

    if (!entryId || !entryName || !gameTypes || !Array.isArray(gameTypes) || !registrations || !Array.isArray(registrations)) {
      console.log('Validation failed:', { entryId, entryName, gameTypes, registrations });
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (gameTypes.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one game type must be selected' });
    }

    // Parse date - default to today
    const registerDate = gameDate ? new Date(gameDate) : new Date();
    const startDate = new Date(registerDate.getFullYear(), registerDate.getMonth(), registerDate.getDate());
    const endDate = new Date(registerDate.getFullYear(), registerDate.getMonth(), registerDate.getDate() + 1);

    // Check if entry is already registered for this date
    const existingRegistration = await ChickenFightRegistration.findOne({
      entryId,
      gameDate: {
        $gte: startDate,
        $lt: endDate
      }
    });

    if (existingRegistration) {
      // Already registered for today - just return existing registration
      return res.json({
        success: true,
        message: `Entry "${entryName}" already registered for today`,
        registration: existingRegistration
      });
    }

    // Create registration record using the registrations array from frontend
    const registration = new ChickenFightRegistration({
      entryId,
      entryName,
      gameDate: registerDate,
      registrations: registrations.map(reg => ({
        gameType: reg.gameType,
        registrationFee: reg.registrationFee,
        isPaid: false,
        paidDate: null,
        paidBy: null
      })),
      createdBy: username
    });

    console.log('Saving registration with data:', registration);
    await registration.save();

    res.json({
      success: true,
      message: `Entry "${entryName}" registered for ${gameTypes.join(', ')}`,
      registration
    });
  } catch (err) {
    console.error('Error registering entry:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// Mark registration as paid (record payment)
router.put('/registrations/:registrationId/pay', async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { gameType } = req.body;
    const username = req.user.username;

    if (!gameType || !['2wins', '3wins'].includes(gameType)) {
      return res.status(400).json({ success: false, message: 'Invalid game type' });
    }

    const registration = await ChickenFightRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // Find and update the specific game type registration
    const gameReg = registration.registrations.find(r => r.gameType === gameType);
    if (!gameReg) {
      return res.status(404).json({ success: false, message: `No registration for ${gameType}` });
    }

    gameReg.isPaid = true;
    gameReg.paidDate = new Date();
    gameReg.paidBy = username;

    registration.updatedBy = username;
    // Mark the registrations array as modified to ensure updatedAt is updated
    registration.markModified('registrations');
    await registration.save();

    res.json({
      success: true,
      message: `Payment recorded for ${gameType}`,
      registration
    });
  } catch (err) {
    console.error('Error marking payment:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// Withdraw payment (mark as unpaid)
router.put('/registrations/:registrationId/withdraw', async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { gameType } = req.body;
    const username = req.user.username;

    if (!gameType || !['2wins', '3wins'].includes(gameType)) {
      return res.status(400).json({ success: false, message: 'Invalid game type' });
    }

    const registration = await ChickenFightRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // Find and update the specific game type registration
    const gameReg = registration.registrations.find(r => r.gameType === gameType);
    if (!gameReg) {
      return res.status(404).json({ success: false, message: `No registration for ${gameType}` });
    }

    gameReg.isPaid = false;
    gameReg.paidDate = null;
    gameReg.paidBy = null;

    registration.updatedBy = username;
    // Mark the registrations array as modified to ensure updatedAt is updated
    registration.markModified('registrations');
    await registration.save();

    res.json({
      success: true,
      message: `Payment withdrawn for ${gameType}`,
      registration
    });
  } catch (err) {
    console.error('Error withdrawing payment:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// Record insurance payment
router.put('/registrations/:registrationId/insurance', async (req, res) => {
  try {
    const { registrationId } = req.params;
    const username = req.user.username;

    const registration = await ChickenFightRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    registration.insurancePaid = !registration.insurancePaid;
    registration.insurancePaidDate = registration.insurancePaid ? new Date() : null;
    registration.insurancePaidBy = registration.insurancePaid ? username : null;
    registration.updatedBy = username;
    
    await registration.save();

    res.json({
      success: true,
      message: registration.insurancePaid ? 'Insurance recorded' : 'Insurance removed',
      registration
    });
  } catch (err) {
    console.error('Error recording insurance:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// Get registration statistics for a date
router.get('/registrations-stats', async (req, res) => {
  try {
    const { gameDate } = req.query;

    if (!gameDate) {
      return res.status(400).json({ success: false, message: 'gameDate is required' });
    }

    const startDate = new Date(`${gameDate}T00:00:00Z`);
    const endDate = new Date(`${gameDate}T23:59:59Z`);

    const registrations = await ChickenFightRegistration.find({
      gameDate: {
        $gte: startDate,
        $lte: endDate
      }
    });

    let stats = {
      total: registrations.length,
      by2wins: 0,
      by3wins: 0,
      paid2wins: 0,
      paid3wins: 0,
      unpaid2wins: 0,
      unpaid3wins: 0,
      totalRevenue: 0
    };

    registrations.forEach(reg => {
      reg.registrations.forEach(gameReg => {
        if (gameReg.gameType === '2wins') {
          stats.by2wins++;
          if (gameReg.isPaid) {
            stats.paid2wins++;
            stats.totalRevenue += gameReg.registrationFee || 300;
          } else {
            stats.unpaid2wins++;
          }
        } else if (gameReg.gameType === '3wins') {
          stats.by3wins++;
          if (gameReg.isPaid) {
            stats.paid3wins++;
            stats.totalRevenue += gameReg.registrationFee || 1000;
          } else {
            stats.unpaid3wins++;
          }
        }
      });
    });

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// Delete/unregister an entry
router.delete('/registrations/:registrationId', async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await ChickenFightRegistration.findByIdAndDelete(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    res.json({
      success: true,
      message: 'Registration deleted',
      registration
    });
  } catch (err) {
    console.error('Error deleting registration:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// Toggle valid champion status
router.put('/registrations/:registrationId/valid-champion', async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { isValidChampion } = req.body;
    const username = req.user.username;

    const registration = await ChickenFightRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    registration.isValidChampion = isValidChampion;
    registration.updatedBy = username;
    await registration.save();

    res.json({
      success: true,
      message: `Champion status updated to ${isValidChampion ? 'valid' : 'invalid'}`,
      registration
    });
  } catch (err) {
    console.error('Error updating champion status:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

export default router;
