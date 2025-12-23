import express from "express";
import TellerSession from "../models/TellerSession.js";
import User from "../models/User.js";

const router = express.Router();

// 🟢 Get tellers without capital (available)
router.get("/available", async (req, res) => {
  try {
    // Find all tellers (including supervisor_teller)
    const tellers = await User.find({ 
      role: { $in: ["teller", "supervisor_teller"] } 
    }).select("_id fullName username");

    // Find tellers that already have a session today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessions = await TellerSession.find({ date: { $gte: today } }).select("tellerId");
    const assignedTellerIds = sessions.map((s) => s.tellerId.toString());

    // Filter tellers with no capital yet
    const available = tellers.filter((t) => !assignedTellerIds.includes(t._id.toString()));

    res.json(
      available.map((t) => ({
        id: t._id,
        teller_name: t.fullName || t.username,
      }))
    );
  } catch (err) {
    console.error("Error fetching available tellers:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟢 Get supervisor’s current tellers
router.get("/my-tellers", async (req, res) => {
  try {
    const supervisorId = req.user?._id || req.headers["x-supervisor-id"]; // fallback for testing
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await TellerSession.find({
      supervisorId,
      date: { $gte: today },
    });

    res.json(
      sessions.map((s) => ({
        id: s._id,
        teller_name: s.tellerName,
        capital_amount: s.capital,
        additional_capital: s.additional,
        remittance_amount: s.remittance,
        status: "Active",
      }))
    );
  } catch (err) {
    console.error("Error fetching supervisor tellers:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟩 Add starting capital
router.post("/assign", async (req, res) => {
  try {
    const supervisorId = req.user?._id || req.headers["x-supervisor-id"];
    const { teller_id, capital_amount } = req.body;

    const teller = await User.findById(teller_id);
    if (!teller) return res.status(404).json({ message: "Teller not found" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if teller already has a session
    const existing = await TellerSession.findOne({
      tellerId: teller._id,
      date: { $gte: today },
    });
    if (existing) return res.status(400).json({ message: "Teller already has capital" });

    const session = new TellerSession({
      supervisorId,
      tellerId: teller._id,
      tellerName: teller.fullName || teller.username,
      capital: capital_amount,
    });

    await session.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Error assigning capital:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟦 Add additional capital
router.put("/add-capital/:id", async (req, res) => {
  try {
    const { amount } = req.body;
    await TellerSession.findByIdAndUpdate(req.params.id, { $inc: { additional: amount } });
    res.json({ success: true });
  } catch (err) {
    console.error("Error adding capital:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟨 Remittance
router.put("/remit/:id", async (req, res) => {
  try {
    const { amount } = req.body;
    await TellerSession.findByIdAndUpdate(req.params.id, { $inc: { remittance: amount } });
    res.json({ success: true });
  } catch (err) {
    console.error("Error recording remittance:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 🟥 Reset Teller (clear session)
router.put("/reset/:id", async (req, res) => {
  try {
    await TellerSession.findByIdAndUpdate(req.params.id, {
      capital: 0,
      additional: 0,
      remittance: 0,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Error resetting teller:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
