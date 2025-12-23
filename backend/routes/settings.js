// backend/routes/settings.js
import express from "express";
import SystemSettings from "../models/SystemSettings.js";

const router = express.Router();
const getIO = (req) => req.app.get("io");

// GET /api/settings - return the single settings document (or defaults)
router.get("/", async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      // return basic defaults if nothing stored
      settings = {
        baseSalary: 0,
        theme: { mode: "light", lightBg: "#ffffff", darkBg: "#111827" },
        commission: { rmi: 50, operator: 50 }, // example default
      };
    }
    res.json(settings);
  } catch (err) {
    console.error("❌ Error fetching settings:", err);
    res.status(500).json({ message: "Server error fetching settings" });
  }
});

// PUT /api/settings - update system settings (admin)
router.put("/", async (req, res) => {
  try {
    const body = req.body;
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create(body);
    } else {
      Object.assign(settings, body);
      await settings.save();
    }

    const io = getIO(req);
    io?.emit("settingsUpdated", settings);
    io?.emit("toast", { type: "info", message: "System settings updated" });

    res.json(settings);
  } catch (err) {
    console.error("❌ Error updating settings:", err);
    res.status(500).json({ message: "Server error updating settings" });
  }
});

export default router;
