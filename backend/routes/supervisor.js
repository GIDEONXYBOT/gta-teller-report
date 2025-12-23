import express from "express";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import TellerReport from "../models/TellerReport.js";
import DailyTellerAssignment from "../models/DailyTellerAssignment.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Payroll from "../models/Payroll.js";
import SupervisorReport from "../models/SupervisorReport.js";
import SupervisorPayroll from "../models/SupervisorPayroll.js";

const router = express.Router();

/**
 * 🧭 GET /api/supervisor/dashboard
 * Returns supervisor dashboard summary
 */
router.get("/dashboard", async (req, res) => {
  try {
    const supervisorId = req.query.supervisorId;
    if (!supervisorId || !mongoose.Types.ObjectId.isValid(supervisorId)) {
      return res.status(400).json({ message: "Missing or invalid supervisorId" });
    }

    // Use tomorrow's assignments for supervisor side (view-only)
    const now = DateTime.now().setZone("Asia/Manila");
    const dayKey = now.plus({ days: 1 }).toFormat("yyyy-MM-dd"); // tomorrow
    const start = now.startOf("day").toJSDate();
    const end = now.endOf("day").toJSDate();

    // Fetch tomorrow's assignments for this supervisor (view-only)
    const assignments = await DailyTellerAssignment.find({ dayKey, supervisorId }).lean();
    const tellerIds = assignments.map((a) => a.tellerId).filter(Boolean);

    const tellers = tellerIds.length
      ? await User.find({ _id: { $in: tellerIds } }).select("name username active").lean()
      : [];

    // Summary limited to assigned tellers today
    const [verifiedReports, pendingReports, capitalAgg] = await Promise.all([
      TellerReport.countDocuments({ tellerId: { $in: tellerIds }, verified: true, createdAt: { $gte: start, $lte: end } }),
      TellerReport.countDocuments({ tellerId: { $in: tellerIds }, verified: false, createdAt: { $gte: start, $lte: end } }),
      TellerReport.aggregate([
        { $match: { tellerId: { $in: tellerIds }, createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$cashOnHand" } } },
      ]),
    ]);

    // ✅ Today's transaction aggregates for this supervisor
    const [capitalTxns, additionalTxns, remittanceTxns] = await Promise.all([
      Transaction.aggregate([
        { $match: { supervisorId: new mongoose.Types.ObjectId(supervisorId), type: 'capital', createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { supervisorId: new mongoose.Types.ObjectId(supervisorId), type: 'additional', createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { supervisorId: new mongoose.Types.ObjectId(supervisorId), type: 'remittance', createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    // ✅ Supervisor's own payroll (latest month)
    const supervisor = await User.findById(supervisorId).select('baseSalary name username').lean();
    const monthStart = new Date(now.year, now.month - 1, 1);
    const monthEnd = new Date(now.year, now.month, 0, 23, 59, 59);
    const payroll = await Payroll.findOne({
      user: supervisorId,
      createdAt: { $gte: monthStart, $lte: monthEnd },
    }).lean();

    res.json({
      summary: {
        totalTellers: tellerIds.length,
        verifiedReports,
        pendingReports,
        totalCapital: capitalAgg[0]?.total || 0,
        todayCapitalAdded: capitalTxns[0]?.total || 0,
        todayAdditional: additionalTxns[0]?.total || 0,
        todayRemittance: remittanceTxns[0]?.total || 0,
      },
      payroll: payroll ? {
        totalSalary: payroll.totalSalary || 0,
        baseSalary: payroll.baseSalary || supervisor?.baseSalary || 0,
        month: now.toFormat('MMMM yyyy'),
      } : null,
      tellers: tellers.map((t) => ({ _id: t._id, name: t.name || t.username, active: !!t.active })),
    });
  } catch (err) {
    console.error("Error loading supervisor dashboard:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * 📊 GET /api/supervisor/reports
 * Returns merged teller reports per supervisor
 */
router.get("/reports", async (req, res) => {
  try {
    const { supervisor } = req.query;
    const match = supervisor ? { supervisorName: supervisor } : {};
    const reports = await TellerReport.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalTellers: { $addToSet: "$tellerName" },
          verifiedReports: { $sum: { $cond: ["$verified", 1, 0] } },
          totalCapital: { $sum: "$cashOnHand" },
        },
      },
    ]);

    const result = reports[0] || { totalTellers: [], verifiedReports: 0, totalCapital: 0 };
    result.totalTellers = result.totalTellers.length;

    res.json(result);
  } catch (err) {
    console.error("Error loading supervisor report:", err);
    res.status(500).json({ message: "Failed to load supervisor report" });
  }
});

/**
 * 🧾 GET /api/supervisor/payroll
 * Returns supervisor's payroll details
 */
router.get("/payroll", async (req, res) => {
  try {
    const supervisorId = req.query.supervisorId;
    if (!supervisorId) return res.status(400).json({ message: "Supervisor ID required" });

    // Get ALL payrolls for this supervisor from the regular Payroll collection
    const payrolls = await Payroll.find({ user: supervisorId })
      .sort({ createdAt: -1 })
      .populate("user", "username name role")
      .lean();

    if (!payrolls || payrolls.length === 0) {
      console.warn("⚠️ No payroll found for supervisor:", supervisorId);
      return res.json({ success: true, payrolls: [] });
    }

    res.json({ success: true, payrolls });
  } catch (err) {
    console.error("Error fetching supervisor payroll:", err);
    res.status(500).json({ message: "Failed to fetch payroll" });
  }
});

/**
 * ➕ POST /api/supervisor/payroll
 * Create or update supervisor payroll
 */
router.post("/payroll", async (req, res) => {
  try {
    const data = req.body;
    if (!data.supervisorId) return res.status(400).json({ message: "Supervisor ID required" });

    const updated = await SupervisorPayroll.findOneAndUpdate(
      { supervisorId: data.supervisorId },
      { ...data, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    if (global.io) global.io.emit("payrollUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("Error saving payroll:", err);
    res.status(500).json({ message: "Failed to save payroll" });
  }
});

/**
 * 💸 POST /api/supervisor/withdraw
 * Creates a withdrawal request
 */
router.post("/withdraw", async (req, res) => {
  try {
    const { supervisorId, amount, notes } = req.body;
    if (!supervisorId || !amount) return res.status(400).json({ message: "Missing fields" });

    const withdrawal = await SupervisorWithdrawal.create({
      supervisorId,
      amount,
      notes,
    });

    if (global.io) global.io.emit("withdrawalCreated", withdrawal);
    res.json(withdrawal);
  } catch (err) {
    console.error("Error creating withdrawal:", err);
    res.status(500).json({ message: "Failed to create withdrawal" });
  }
});

/**
 * 📋 GET /api/supervisor/withdrawals
 * Returns all withdrawals for the current supervisor
 */
router.get("/withdrawals", async (req, res) => {
  try {
    const { supervisorId } = req.query;
    const filter = supervisorId ? { supervisorId } : {};
    const withdrawals = await SupervisorWithdrawal.find(filter).sort({ createdAt: -1 });
    res.json(withdrawals);
  } catch (err) {
    console.error("Error fetching withdrawals:", err);
    res.status(500).json({ message: "Failed to load withdrawals" });
  }
});

/**
 * ⚙️ PUT /api/supervisor/withdrawals/:id
 * Update withdrawal status (admin use)
 */
router.put("/withdrawals/:id", async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await SupervisorWithdrawal.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (global.io) global.io.emit("withdrawalUpdated", updated);
    res.json(updated);
  } catch (err) {
    console.error("Error updating withdrawal:", err);
    res.status(500).json({ message: "Failed to update withdrawal" });
  }
});

/**
 * ✅ POST /api/supervisor/submit-report
 * Marks supervisor's daily report as submitted
 */
router.post("/submit-report", async (req, res) => {
  try {
    const { supervisorId, supervisorName } = req.body;
    
    if (!supervisorId) {
      return res.status(400).json({ message: "Supervisor ID required" });
    }

    // Get today's date key
    const now = DateTime.now().setZone("Asia/Manila");
    const dateKey = now.toFormat("yyyy-MM-dd");

    // Find or create today's supervisor report
    let report = await SupervisorReport.findOne({ supervisorId, dateKey });

    if (!report) {
      // Create new report if it doesn't exist
      report = new SupervisorReport({
        supervisorId,
        supervisorName: supervisorName || "",
        dateKey,
        tellerCount: 0,
        submitted: true,
        submittedAt: new Date(),
      });
    } else {
      // Update existing report
      report.submitted = true;
      report.submittedAt = new Date();
    }

    await report.save();

    // Emit socket event for real-time updates
    if (req.app.io) {
      req.app.io.emit("supervisorReportSubmitted", { 
        supervisorId, 
        supervisorName: report.supervisorName,
        dateKey 
      });
    }

    console.log(`✅ Supervisor ${supervisorName} submitted report for ${dateKey}`);
    
    res.json({ 
      success: true, 
      message: "Report submitted successfully",
      report 
    });
  } catch (err) {
    console.error("Error submitting supervisor report:", err);
    res.status(500).json({ message: "Failed to submit report" });
  }
});

export default router;
