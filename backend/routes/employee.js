import express from "express";
import EmployeeOfMonth from "../models/EmployeeOfMonth.js";
import User from "../models/User.js";

const router = express.Router();

// GET /api/employee?month=November 2025
router.get("/", async (req, res) => {
  try {
    const month = req.query.month || new Date().toLocaleString("default", { month: "long", year: "numeric" });
    const rows = await EmployeeOfMonth.find({ month })
      .populate("tellerId", "fullName username")
      .populate("supervisorId", "fullName username")
      .sort({ totalBet: -1 });

    // map to friendly output
    const out = rows.map((r) => ({
      _id: r._id,
      tellerId: r.tellerId._id,
      tellerName: r.tellerId.fullName || r.tellerId.username,
      supervisorName: r.supervisorId ? (r.supervisorId.fullName || r.supervisorId.username) : null,
      totalBet: r.totalBet,
      month: r.month,
      rank: r.rank,
      reward: r.reward || "",
    }));

    res.json(out);
  } catch (err) {
    console.error("❌ Error fetching leaderboard:", err);
    res.status(500).json({ message: "Failed to load leaderboard" });
  }
});

// POST /api/employee/input - supervisor or assistant adds teller bet
router.post("/input", async (req, res) => {
  try {
    const { tellerId, supervisorId, totalBet } = req.body;
    if (!tellerId || totalBet == null) return res.status(400).json({ message: "Missing fields" });

    const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });

    let record = await EmployeeOfMonth.findOne({ tellerId, month });
    if (record) {
      record.totalBet += totalBet;
    } else {
      record = new EmployeeOfMonth({ tellerId, supervisorId, totalBet, month });
    }
    await record.save();

    // re-rank
    const all = await EmployeeOfMonth.find({ month }).sort({ totalBet: -1 });
    for (let i = 0; i < all.length; i++) {
      all[i].rank = i + 1;
      await all[i].save();
    }

    res.json({ message: "Recorded and ranks updated" });
  } catch (err) {
    console.error("❌ Error recording total bet:", err);
    res.status(500).json({ message: "Failed to record total bet" });
  }
});

// PUT /api/employee/reward/:rank - admin sets reward for a rank
router.put("/reward/:rank", async (req, res) => {
  try {
    const rank = parseInt(req.params.rank, 10);
    const { reward } = req.body;
    const month = new Date().toLocaleString("default", { month: "long", year: "numeric" });

    const employee = await EmployeeOfMonth.findOneAndUpdate({ month, rank }, { reward }, { new: true });
    if (!employee) return res.status(404).json({ message: "Rank not found for this month" });

    res.json({ message: "Reward updated", employee });
  } catch (err) {
    console.error("❌ Error updating reward:", err);
    res.status(500).json({ message: "Failed to update reward" });
  }
});

export default router;
