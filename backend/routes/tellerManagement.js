import express from "express";
import mongoose from "mongoose";
import Capital from "../models/Capital.js";
import Payroll from "../models/Payroll.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js"; // your model name
import SystemSettings from "../models/SystemSettings.js";
// ✅ If you have TellerTransaction.js, keep using it — they are equivalent.

const router = express.Router();

/* ======================================================
   EXISTING + ENHANCED TELLER MANAGEMENT ROUTES
   ====================================================== */

// ✅ Get active capital for a teller
router.get("/capital/:tellerId", async (req, res) => {
  try {
    const { tellerId } = req.params;

    const activeCapital = await Capital.findOne({
      tellerId,
      status: "active"
    }).populate('supervisorId', 'name username').lean();

    if (!activeCapital) {
      return res.json(null); // No active capital found
    }

    res.json(activeCapital);
  } catch (err) {
    console.error("❌ Error fetching active capital:", err);
    res.status(500).json({ error: "Failed to fetch active capital" });
  }
});

// ✅ Add capital
router.post("/add-capital", async (req, res) => {
  try {
    const { tellerId, supervisorId, amount, note } = req.body;

    if (!tellerId || !supervisorId || !amount)
      return res.status(400).json({ error: "Missing required fields" });

    // Create new capital record
    const newCapital = await Capital.create({
      tellerId,
      supervisorId,
      amount,
      balanceRemaining: amount,
      totalRemitted: 0,
      status: "active",
      note,
      createdAt: new Date(),
    });

    // ✅ Auto-link teller to supervisor (one-time setup)
    const tellerUser = await User.findByIdAndUpdate(
      tellerId,
      { supervisorId },
      { new: true }
    );

    // ✅ For supervisor_teller: Set base salary to teller rate (450) when receiving capital
    if (tellerUser && tellerUser.role === 'supervisor_teller') {
      const settings = await SystemSettings.findOne().lean();
      const tellerBase = settings?.baseSalary?.teller || 450;
      
      if (tellerUser.baseSalary !== tellerBase) {
        await User.findByIdAndUpdate(tellerId, { baseSalary: tellerBase });
        console.log(`✅ Set ${tellerUser.name || tellerUser.username} (supervisor_teller) base salary to ₱${tellerBase}`);
      }
    }

    // ✅ If supervisor has no payroll entry for current month yet, create base-only payroll
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const supervisorUser = await User.findById(supervisorId).lean();
      if (supervisorUser && supervisorUser.role === "supervisor") {
        const existing = await Payroll.findOne({
          user: supervisorId,
          createdAt: { $gte: monthStart, $lte: monthEnd },
        }).lean();
        if (!existing) {
          const payroll = new Payroll({
            user: supervisorId,
            role: supervisorUser.role,
            baseSalary: supervisorUser.baseSalary || 0,
            over: 0,
            short: 0,
            deduction: 0,
            withdrawal: 0,
            totalSalary: supervisorUser.baseSalary || 0,
          });
          await payroll.save();
          if (req.app && req.app.io) {
            req.app.io.emit("payrollUpdated", { userId: supervisorId, payrollId: payroll._id });
          }
          console.log(`✅ Base salary payroll created for supervisor ${supervisorId}`);
        }
      }
    } catch (e) {
      console.warn("⚠️ Failed supervisor base payroll auto-create:", e.message);
    }

    // ✅ Emit live update to dashboards
    if (req.app && req.app.io) {
      req.app.io.emit("tellerManagementUpdated");
      req.app.io.emit("supervisorReportUpdated", { supervisorId });
    }

    res.json({
      success: true,
      message: "Capital added successfully",
      capital: newCapital,
    });
  } catch (err) {
    console.error("❌ Error adding capital:", err);
    res.status(500).json({ error: "Failed to add capital" });
  }
});

/* ======================================================
   REMITTANCE + ADDITIONAL CAPITAL HANDLERS
   ====================================================== */

// ✅ Add additional capital
router.put("/:tellerId/add-additional", async (req, res) => {
  try {
    const { tellerId } = req.params;
    const { amount, note, userId } = req.body;

    const capital = await Capital.findOne({ tellerId, status: "active" });
    if (!capital)
      return res.status(404).json({ error: "Active capital not found" });

    // ✅ Record additional capital transaction AND update Capital model
    await Transaction.create({
      tellerId,
      type: "additional",
      amount,
      note,
      date: new Date(),
      userId,
    });

    // ✅ Update Capital model's totalAdditional
    await Capital.findByIdAndUpdate(
      capital._id,
      { $inc: { totalAdditional: amount } },
      { new: true }
    );

    if (req.app && req.app.io) {
      req.app.io.emit("tellerManagementUpdated");
      req.app.io.emit("supervisorReportUpdated", {
        supervisorId: capital.supervisorId,
      });
    }

    res.json({ success: true, message: "Additional capital added", capital });
  } catch (err) {
    console.error("❌ Error adding additional capital:", err);
    res.status(500).json({ error: "Failed to add additional capital" });
  }
});

// ✅ Remit funds
router.put("/:tellerId/remit", async (req, res) => {
  try {
    const { tellerId } = req.params;
    const { amount, note, userId } = req.body;

    const capital = await Capital.findOne({ tellerId, status: "active" });
    if (!capital)
      return res.status(404).json({ error: "Active capital not found" });

    // ✅ Record remittance transaction AND update Capital model
    await Transaction.create({
      tellerId,
      type: "remit",
      amount,
      note,
      date: new Date(),
      userId,
    });

    // ✅ Update Capital model's totalRemitted
    await Capital.findByIdAndUpdate(
      capital._id,
      { $inc: { totalRemitted: amount } },
      { new: true }
    );

    if (req.app && req.app.io) {
      req.app.io.emit("tellerManagementUpdated");
      req.app.io.emit("supervisorReportUpdated", {
        supervisorId: capital.supervisorId,
      });
    }

    res.json({ success: true, message: "Remittance recorded", capital });
  } catch (err) {
    console.error("❌ Error remitting:", err);
    res.status(500).json({ error: "Failed to remit" });
  }
});

/* ======================================================
   FETCH LOGIC (ADMIN + SUPERVISOR)
   ====================================================== */

// ✅ Admin: Get all supervisors and their assigned tellers
router.get("/all/list", async (req, res) => {
  try {
    const supervisors = await User.find({ role: "supervisor" }).lean();

    const data = await Promise.all(
      supervisors.map(async (sup) => {
        const tellers = await User.find({
          role: "teller",
          supervisorId: sup._id,
        }).lean();

        const tellersWithCapital = await Promise.all(
          tellers.map(async (t) => ({
            tellerId: t._id,
            tellerName: t.name || t.username,
            activeCapital: await Capital.findOne({
              tellerId: t._id,
              status: "active",
            }).lean(),
          }))
        );

        return {
          _id: sup._id,
          name: sup.name || sup.username,
          tellers: tellersWithCapital,
        };
      })
    );

    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching admin teller list:", err);
    res.status(500).json({ error: "Failed to load teller management data" });
  }
});

// ✅ Supervisor: Get their assigned tellers
router.get("/:supervisorId", async (req, res) => {
  try {
    const { supervisorId } = req.params;
    const tellers = await User.find({
      role: "teller",
      supervisorId,
    }).lean();

    const data = await Promise.all(
      tellers.map(async (t) => ({
        tellerId: t._id,
        tellerName: t.name || t.username,
        supervisorName: (
          await User.findById(supervisorId).select("name username").lean()
        )?.name,
        activeCapital: await Capital.findOne({
          tellerId: t._id,
          status: "active",
        }).lean(),
      }))
    );

    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching supervisor tellers:", err);
    res.status(500).json({ error: "Failed to load tellers" });
  }
});

// ✅ Teller Details (modal)
router.get("/:tellerId/details", async (req, res) => {
  try {
    const { tellerId } = req.params;
    const activeCapital = await Capital.findOne({
      tellerId,
      status: "active",
    }).lean();
    const transactions = await Transaction.find({ tellerId })
      .sort({ date: -1 })
      .lean();

    res.json({ activeCapital, transactions });
  } catch (err) {
    console.error("❌ Error fetching teller details:", err);
    res.status(500).json({ error: "Failed to fetch teller details" });
  }
});

export default router;
