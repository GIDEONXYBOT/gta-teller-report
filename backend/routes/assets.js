// routes/assets.js
import express from 'express';
import mongoose from 'mongoose';
const router = express.Router();

const assetSchema = new mongoose.Schema({
  assetType: String,
  assetId: String,
  qrData: String,
  assignedTo: { type: String, default: null },
  status: { type: String, default: 'available' },
  scannedBy: { type: String, default: null },
  scannedAt: { type: Date, default: null }
});
const Asset = mongoose.models.Asset || mongoose.model('Asset', assetSchema);

router.post('/register', async (req, res) => {
  try {
    const assets = req.body.assets;
    const result = await Asset.insertMany(assets);
    res.json({ success: true, assets: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

router.get('/all', async (req, res) => {
  try {
    const assets = await Asset.find();
    res.json({ success: true, assets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
