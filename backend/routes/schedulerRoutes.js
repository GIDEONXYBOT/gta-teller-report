import express from "express";
import { scheduleDailyReset, getScheduledTime } from "../scheduler/midnightReset.js";
import Config from "../models/Config.js";
import { DateTime } from "luxon";

const router = express.Router();

const formatHHMM = (hour, minute) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

router.get("/", async (req, res) => {
  try {
    if (Config) {
      const cfg = await Config.findOne();
      if (cfg && (cfg.resetHour !== undefined || cfg.resetMinute !== undefined)) {
        const hh = cfg.resetHour ?? 0;
        const mm = cfg.resetMinute ?? 0;
        return res.json({ resetTime: formatHHMM(hh, mm) });
      }
    }
  } catch (err) {
    console.warn("⚠️ schedulerRoutes GET read Config failed:", err);
  }

  try {
    const scheduled = getScheduledTime();
    if (scheduled) return res.json({ resetTime: scheduled });
  } catch (err) {}

  return res.json({ resetTime: "04:00" });
});

router.put("/", async (req, res) => {
  try {
    let { time } = req.body;

    // ✅ Sanitize bad values
    if (!time || typeof time !== "string" || time.includes("Invalid")) {
      console.warn("⚠️ Received invalid time value:", time);
      return res.status(400).json({ message: "Invalid time format. Expected HH:MM" });
    }

    // normalize to HH:mm
    time = time.trim().slice(0, 5);
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      return res.status(400).json({ message: "Invalid time format (HH:MM)" });
    }

    const [hourStr, minuteStr] = time.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return res.status(400).json({ message: "Invalid hour or minute" });
    }

    try {
      if (Config) {
        let cfg = await Config.findOne();
        if (!cfg) {
          cfg = new Config({ resetHour: hour, resetMinute: minute, timezone: "Asia/Manila" });
        } else {
          cfg.resetHour = hour;
          cfg.resetMinute = minute;
        }
        await cfg.save();
      }
    } catch (err) {
      console.warn("⚠️ schedulerRoutes PUT persist to Config failed:", err);
    }

    scheduleDailyReset(formatHHMM(hour, minute));

    const next = DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
    return res.json({
      message: `Reset time updated to ${formatHHMM(hour, minute)}`,
      resetTime: formatHHMM(hour, minute),
      appliedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Error updating reset time:", err);
    return res.status(500).json({ message: "Failed to update reset time" });
  }
});

export default router;
