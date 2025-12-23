// backend/routes/cashflowArchive.js
import express from "express";
import CashflowArchive from "../models/CashflowArchive.js";

const router = express.Router();

/**
 * 📦 GET all archived cashflow records (sorted by newest first)
 */
router.get("/", async (req, res) => {
  try {
    const archives = await CashflowArchive.find().sort({ date: -1 });
    res.json(archives);
  } catch (err) {
    console.error("❌ Error fetching archives:", err);
    res.status(500).json({ message: "Server error fetching archives" });
  }
});

/**
 * 🔍 GET one archive by specific date (yyyy-mm-dd)
 */
router.get("/:date", async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const archive = await CashflowArchive.findOne({
      date: { $gte: date, $lt: nextDay },
    });

    if (!archive)
      return res.status(404).json({ message: "No record found for this date" });

    res.json(archive);
  } catch (err) {
    console.error("❌ Error fetching archive by date:", err);
    res.status(500).json({ message: "Server error fetching archive" });
  }
});

export default router;
