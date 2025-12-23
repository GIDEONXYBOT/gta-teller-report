import express from "express";
import mongoose from "mongoose";
import SystemSettings from "../models/SystemSettings.js";

const router = express.Router();

// ============================
// 💾 Mongoose Schema (keep model if standalone)
// ============================
const CashflowSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // "income" | "expense"
    category: { type: String, required: true }, // e.g. supply, food
    amount: { type: Number, required: true },
    description: { type: String },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Cashflow =
  mongoose.models.Cashflow || mongoose.model("Cashflow", CashflowSchema);

// ============================
// 📄 Get all cashflow entries (optionally filter by date)
// ============================
router.get("/", async (req, res) => {
  try {
    const { date } = req.query;
    const filter = {};
    if (date) {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      filter.date = { $gte: start, $lte: end };
    }

    const data = await Cashflow.find(filter).sort({ date: -1 });
    res.json(data);
  } catch (err) {
    console.error("❌ Failed to fetch cashflow:", err);
    res.status(500).json({ message: "Server error fetching cashflow" });
  }
});

// ============================
// ➕ Add new cashflow entry
// ============================
router.post("/", async (req, res) => {
  try {
    const { type = "expense", category, amount = 0, description, date } = req.body;
    const entry = new Cashflow({
      type,
      category,
      amount: Number(amount),
      description,
      date: date ? new Date(date) : new Date(),
    });

    await entry.save();

    // 🔔 Real-time updates using global.io
    global.io?.emit("cashflowUpdated");
    global.io?.emit("toast", { type: "success", message: "New cashflow entry added" });

    res.status(201).json(entry);
  } catch (err) {
    console.error("❌ Failed to add cashflow:", err);
    res.status(500).json({ message: "Server error adding cashflow" });
  }
});

// ============================
// ✏️ Update cashflow entry
// ============================
router.put("/:id", async (req, res) => {
  try {
    const updated = await Cashflow.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    global.io?.emit("cashflowUpdated");
    global.io?.emit("toast", { type: "info", message: "Cashflow entry updated" });

    res.json(updated);
  } catch (err) {
    console.error("❌ Failed to update cashflow:", err);
    res.status(500).json({ message: "Server error updating cashflow" });
  }
});

// ============================
// 🗑️ Delete cashflow entry
// ============================
router.delete("/:id", async (req, res) => {
  try {
    await Cashflow.findByIdAndDelete(req.params.id);

    global.io?.emit("cashflowUpdated");
    global.io?.emit("toast", { type: "warning", message: "Cashflow entry deleted" });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("❌ Failed to delete cashflow:", err);
    res.status(500).json({ message: "Server error deleting cashflow" });
  }
});

// ============================
// 📊 Get Daily Summary for Reports
// ============================
router.get("/summary/daily", async (req, res) => {
  try {
    const result = await Cashflow.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          totalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.json(result);
  } catch (err) {
    console.error("❌ Error generating daily summary:", err);
    res.status(500).json({ message: "Server error generating summary" });
  }
});

export default router;
