// backend/routes/bettingData.js - Manage betting data in database
import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import BettingData from '../models/BettingData.js';

const router = express.Router();

/**
 * GET /api/betting-data/list
 * Get all betting data
 */
router.get('/list', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const data = await BettingData.find().sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/betting-data/add
 * Add new betting data entry
 */
router.post('/add', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { username, totalBet, mwBetPercent, commission } = req.body;
    
    if (!username || totalBet === undefined || mwBetPercent === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const entry = new BettingData({
      username,
      totalBet: parseFloat(totalBet),
      mwBetPercent: parseFloat(mwBetPercent),
      commission: parseFloat(commission) || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await entry.save();
    res.json({ success: true, data: entry, message: 'Entry added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/betting-data/:id
 * Update betting data entry
 */
router.put('/:id', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { username, totalBet, mwBetPercent, commission } = req.body;
    
    const entry = await BettingData.findByIdAndUpdate(
      req.params.id,
      {
        username,
        totalBet: parseFloat(totalBet),
        mwBetPercent: parseFloat(mwBetPercent),
        commission: parseFloat(commission) || 0,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ success: true, data: entry, message: 'Entry updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/betting-data/:id
 * Delete betting data entry
 */
router.delete('/:id', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const entry = await BettingData.findByIdAndDelete(req.params.id);

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ success: true, message: 'Entry deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/betting-data/export
 * Export all betting data as array (for display in TellerBettingData)
 */
router.get('/export', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const data = await BettingData.find().sort({ totalBet: -1 });
    res.json({ 
      success: true, 
      data: data.map(item => ({
        username: item.username,
        totalBet: item.totalBet,
        mwBetPercent: item.mwBetPercent,
        fetchedAt: item.updatedAt
      })),
      isDemo: false,
      lastFetch: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
