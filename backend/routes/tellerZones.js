import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import TellerZone from "../models/TellerZone.js";
import BettingData from "../models/BettingData.js";

const router = express.Router();

// Get all zones
router.get("/list", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const zones = await TellerZone.find().sort({ createdAt: -1 });
    res.json({ success: true, data: zones });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new zone
router.post("/create", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const { name, region, description } = req.body;

    if (!name || !region) {
      return res.status(400).json({ success: false, error: "Name and region are required" });
    }

    const zone = new TellerZone({
      name,
      region,
      description,
      createdBy: req.user.id,
    });

    await zone.save();
    res.json({ success: true, data: zone });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update zone
router.put("/:id", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const zone = await TellerZone.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!zone) {
      return res.status(404).json({ success: false, error: "Zone not found" });
    }

    res.json({ success: true, data: zone });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete zone
router.delete("/:id", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const zone = await TellerZone.findByIdAndDelete(req.params.id);

    if (!zone) {
      return res.status(404).json({ success: false, error: "Zone not found" });
    }

    res.json({ success: true, message: "Zone deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Assign teller to zone
router.post("/assign", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const { tellerId, zoneId } = req.body;

    if (!tellerId || !zoneId) {
      return res.status(400).json({ success: false, error: "Teller ID and Zone ID are required" });
    }

    const zone = await TellerZone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ success: false, error: "Zone not found" });
    }

    if (!zone.assignedTellers) {
      zone.assignedTellers = [];
    }

    // Add teller if not already assigned
    if (!zone.assignedTellers.includes(tellerId)) {
      zone.assignedTellers.push(tellerId);
      await zone.save();
    }

    res.json({ success: true, data: zone });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove teller from zone
router.post("/unassign", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const { tellerId, zoneId } = req.body;

    const zone = await TellerZone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ success: false, error: "Zone not found" });
    }

    if (zone.assignedTellers) {
      zone.assignedTellers = zone.assignedTellers.filter((id) => id !== tellerId);
      await zone.save();
    }

    res.json({ success: true, data: zone });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get zone performance metrics
router.get("/:id/performance", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const zone = await TellerZone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({ success: false, error: "Zone not found" });
    }

    // Get betting data for assigned tellers
    const bettingData = await BettingData.find({
      username: { $in: zone.assignedTellers || [] }
    });

    const totalBets = bettingData.reduce((sum, d) => sum + (d.totalBet || 0), 0);
    const avgMWBet = bettingData.length > 0
      ? (bettingData.reduce((sum, d) => sum + (d.mwBetPercent || 0), 0) / bettingData.length).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        zone: zone.toObject(),
        performance: {
          totalBets,
          avgMWBet,
          tellerCount: zone.assignedTellers?.length || 0,
          dataPoints: bettingData.length
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
