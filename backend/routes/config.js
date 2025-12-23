import express from "express";
import Config from "../models/Config.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /api/config
router.get("/", requireAuth, async (req, res) => {
  try {
    let cfg = await Config.findOne();
    if (!cfg) {
      cfg = new Config();
      await cfg.save();
    }
    res.json(cfg);
  } catch (err) {
    console.error("❌ Error fetching config:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT /api/config  (admin only)
router.put("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const updates = req.body;
    let cfg = await Config.findOne();
    if (!cfg) {
      cfg = new Config(updates);
    } else {
      Object.assign(cfg, updates);
      cfg.updatedAt = new Date();
    }
    await cfg.save();
    res.json({ message: "Config updated", cfg });
  } catch (err) {
    console.error("❌ Error updating config:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
