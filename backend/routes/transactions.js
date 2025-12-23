import express from "express";
import Transaction from "../models/Transaction.js";

const router = express.Router();

// Fetch all transactions
router.get("/", async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("supervisorId", "fullName role")
      .populate("tellerId", "fullName role")
      .sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    console.error("❌ Error fetching transactions:", err);
    res.status(500).json({ message: "Server error fetching transactions" });
  }
});

// Create a transaction
router.post("/", async (req, res) => {
  try {
    const { supervisorId, tellerId, type, amount } = req.body;

    if (!supervisorId || !tellerId || amount == null) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["starting", "additional", "remittance"].includes(type)) {
      return res.status(400).json({ message: "Invalid transaction type" });
    }

    const tx = new Transaction({ supervisorId, tellerId, type, amount });
    await tx.save();
    console.log("✅ Transaction saved:", tx);
    res.status(201).json({ message: "Transaction saved", tx });
  } catch (err) {
    console.error("❌ Error saving transaction:", err);
    res.status(500).json({ message: "Server error saving transaction" });
  }
});

// Check if teller has starting capital today
router.get("/check/:tellerId", async (req, res) => {
  try {
    const tellerId = req.params.tellerId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existing = await Transaction.findOne({
      tellerId,
      type: "starting",
      date: { $gte: todayStart, $lte: todayEnd },
    });

    res.json({ hasCapital: !!existing });
  } catch (err) {
    console.error("❌ Error checking teller capital:", err);
    res.status(500).json({ message: "Server error checking teller capital" });
  }
});

export default router;
