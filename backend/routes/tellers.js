import express from "express";
import TellerReport from "../models/TellerReport.js";
import User from "../models/User.js";

const router = express.Router();
// List all tellers for assignment dropdown
router.get("/all", async (req, res) => {
  try {
    const tellers = await User.find({ role: "teller" }, "_id name username");
    res.json({ success: true, tellers });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch tellers" });
  }
});

// ✅ Add capital
router.post("/add-capital", async (req, res) => {
  try {
    const { tellerId, supervisorId, capital } = req.body;
    const teller = await User.findById(tellerId);

    if (!teller) return res.status(404).json({ message: "Teller not found" });

    teller.supervisorId = supervisorId;
    await teller.save();

    const report = await TellerReport.create({
      userId: tellerId,
      supervisorId,
      tellerName: teller.username,
      capital,
      date: new Date().toISOString().split("T")[0],
    });

    global.io.emit("reportUpdated");
    res.json(report);
  } catch (err) {
    console.error("❌ Add Capital Error:", err);
    res.status(500).json({ message: "Failed to add capital" });
  }
});

// ✅ Add additional capital
router.post("/add-additional", async (req, res) => {
  try {
    const { tellerId, supervisorId, amount } = req.body;
    const report = await TellerReport.findOneAndUpdate(
      { userId: tellerId },
      { $inc: { additional: amount } },
      { new: true }
    );

    global.io.emit("reportUpdated");
    res.json(report);
  } catch (err) {
    console.error("❌ Add Additional Error:", err);
    res.status(500).json({ message: "Failed to add additional" });
  }
});

// ✅ Record remittance
router.post("/remittance", async (req, res) => {
  try {
    const { tellerId, supervisorId, amount } = req.body;
    const report = await TellerReport.findOneAndUpdate(
      { userId: tellerId },
      { $inc: { remittance: amount } },
      { new: true }
    );

    global.io.emit("reportUpdated");
    res.json(report);
  } catch (err) {
    console.error("❌ Remittance Error:", err);
    res.status(500).json({ message: "Failed to record remittance" });
  }
});

// ✅ Get teller data
router.get("/:tellerId", async (req, res) => {
  try {
    const teller = await TellerReport.findOne({ userId: req.params.tellerId });
    if (!teller)
      return res.json({
        tellerName: "",
        capital: 0,
        additional: 0,
        remittance: 0,
      });
    res.json(teller);
  } catch (err) {
    console.error("❌ Fetch Teller Error:", err);
    res.status(500).json({ message: "Failed to fetch teller data" });
  }
});

export default router;
