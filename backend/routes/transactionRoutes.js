import express from "express";
import Transaction from "../models/Transaction.js";

const router = express.Router();

// Add transaction
router.post("/", async (req, res) => {
  try {
    const tx = new Transaction(req.body);
    await tx.save();
    res.json({ message: "Transaction saved", tx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all transactions
router.get("/", async (req, res) => {
  try {
    const list = await Transaction.find().sort({ date: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
