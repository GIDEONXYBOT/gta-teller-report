import express from 'express';
import MapConfig from '../models/MapConfig.js';
import { protect, adminOrDeclarator } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET current map configuration
router.get('/', protect, adminOrDeclarator, async (req, res) => {
  try {
    let cfg = await MapConfig.findOne();
    if (!cfg) {
      cfg = await MapConfig.create({});
    }
    res.json(cfg);
  } catch (err) {
    console.error('❌ Failed to get map config:', err);
    res.status(500).json({ error: 'Failed to get map config' });
  }
});

// PUT upsert map configuration (admin/declarator ideally)
router.put('/', protect, adminOrDeclarator, async (req, res) => {
  try {
    const { imageData, imageWidth, imageHeight, markers, regions } = req.body || {};
    const update = {
      ...(imageData ? { imageData } : {}),
      ...(imageWidth ? { imageWidth } : {}),
      ...(imageHeight ? { imageHeight } : {}),
      ...(Array.isArray(markers) ? { markers } : {}),
      ...(Array.isArray(regions) ? { regions } : {}),
      updatedAt: new Date(),
    };
    const cfg = await MapConfig.findOneAndUpdate({}, update, { upsert: true, new: true });
    // Broadcast to connected clients if socket is available
    try { req.app?.io?.emit('mapConfigUpdated', cfg); } catch {}
    res.json(cfg);
  } catch (err) {
    console.error('❌ Failed to update map config:', err);
    res.status(500).json({ error: 'Failed to update map config' });
  }
});

export default router;
