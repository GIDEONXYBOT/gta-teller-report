// Asset Management API for QR sticker tracking
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Asset Schema
const assetSchema = new mongoose.Schema({
  assetType: String,
  assetId: String,
  qrData: String,
  assignedTo: { type: String, default: null }, // teller username/id
  status: { type: String, default: 'available' }, // available, deployed, returned
  scannedBy: { type: String, default: null }, // teller username/id
  scannedAt: { type: Date, default: null }
});

const Asset = mongoose.model('Asset', assetSchema);

// Register assets (bulk)
router.post('/register', async (req, res) => {
  try {
    const assets = req.body.assets; // [{ assetType, assetId, qrData }]
    const result = await Asset.insertMany(assets);
    res.json({ success: true, assets: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Scan asset (by teller)
router.post('/scan', async (req, res) => {
  try {
    const { assetId, scannedBy } = req.body;
    const asset = await Asset.findOneAndUpdate(
      { assetId },
      { status: 'deployed', scannedBy, scannedAt: new Date() },
      { new: true }
    );
    res.json({ success: true, asset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all assets (for dashboard)
router.get('/all', async (req, res) => {
  try {
    const assets = await Asset.find();
    res.json({ success: true, assets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
