import express from "express";
import Payroll from "../models/Payroll.js";
import Withdrawal from "../models/Withdrawal.js";
import User from "../models/User.js";
import TellerReport from "../models/TellerReport.js";
import Capital from "../models/Capital.js";
import SystemSettings from "../models/SystemSettings.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { computeTotalSalary } from "../lib/payrollCalc.js";

const router = express.Router();

/* ========================================================
   🧠 ADMIN: Get all payrolls for all users
======================================================== */
router.get("/all", async (req, res) => {
  try {
    const payrolls = await Payroll.find()
      .populate("user", "username name role active status")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, payrolls });
  } catch (err) {
    console.error("❌ Error fetching all payrolls:", err);
    res.status(500).json({ message: "Failed to fetch all payrolls" });
  }
});

/* ========================================================
   💰 PAYROLL MANAGEMENT: Get all payrolls with user details for admin
======================================================== */
router.get("/management", async (req, res) => {
  try {
    const payrolls = await Payroll.find()
      .populate("user", "username name role")
      .sort({ date: -1 })
      .lean();

    // Format data for management view
    const formattedPayrolls = payrolls.map(p => ({
      _id: p._id,
      name: p.user?.name || "Unknown",
      role: p.user?.role || "unknown",
      date: p.date,
      baseSalary: p.baseSalary,
      totalOver: p.over || 0,
      totalShort: p.short || 0,
      totalDeductions: p.deduction || 0,
      totalSalary: p.totalSalary,
      approved: p.approved || false,
      locked: p.locked || false,
    }));

    res.json({ success: true, payrolls: formattedPayrolls });
  } catch (err) {
    console.error("❌ Error fetching payroll management:", err);
    res.status(500).json({ message: "Failed to fetch payroll management data" });
  }
});

/* ========================================================
   💰 NEW: Get latest payroll by USER ID (for SidebarLayout)
======================================================== */
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("📥 Fetching payroll by USER ID:", userId);

    const payrolls = await Payroll.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("user", "username name role")
      .lean();

    if (!payrolls || payrolls.length === 0) {
      console.warn("⚠️ No payroll found for user:", userId);
      return res.json({ success: true, payrolls: [] });
    }

    res.json({ success: true, payrolls });
  } catch (err) {
    console.error("❌ Error fetching payroll by user:", err);
    res.status(500).json({ message: "Failed to fetch payroll by user" });
  }
});

/* ========================================================
   💰 WITHDRAWAL ROUTES (with approval workflow)
======================================================== */
router.post("/:id/withdraw", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount = null, initiatedBy = null, weekRange = null } = req.body;

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found" });
    if (payroll.withdrawn)
      return res.status(400).json({ message: "Already withdrawn" });

    const withdrawAmount =
      amount != null ? Number(amount) : payroll.totalSalary || 0;

    const remainingUnwithdrawn = await Payroll.aggregate([
      { $match: { user: payroll.user, withdrawn: false } },
      { $group: { _id: null, total: { $sum: "$totalSalary" } } },
    ]);
    const remaining =
      (remainingUnwithdrawn[0] && remainingUnwithdrawn[0].total) || 0;

    // Create withdrawal request (pending approval)
    const withdrawal = new Withdrawal({
      userId: payroll.user,
      payrollIds: [payroll._id],
      amount: withdrawAmount,
      remaining,
      weekRange,
      createdBy: initiatedBy,
      status: "pending", // Requires admin approval
    });
    await withdrawal.save();

    // 🔄 Notify all admins of new withdrawal request
    if (global.io) global.io.emit("withdrawalRequested", { 
      withdrawalId: withdrawal._id,
      userId: payroll.user,
      amount: withdrawAmount
    });

    res.json({
      success: true,
      message: "✅ Withdrawal request submitted. Awaiting admin approval.",
      withdrawal,
    });
  } catch (err) {
    console.error("❌ Error in withdraw:", err);
    res.status(500).json({ message: "Failed to process withdrawal" });
  }
});

router.post("/bulk-withdraw", async (req, res) => {
  try {
    const { payrollIds = [], initiatedBy = null, weekRange = null } = req.body;
    if (!Array.isArray(payrollIds) || payrollIds.length === 0)
      return res.status(400).json({ message: "No payroll IDs provided" });

    const payrolls = await Payroll.find({ _id: { $in: payrollIds } });
    if (!payrolls.length)
      return res.status(404).json({ message: "Payrolls not found" });

    // Do NOT mark payrolls withdrawn here. Create a pending withdrawal request.
    // Actual marking happens upon admin approval.
    const total = payrolls.reduce((sum, p) => sum + (p.withdrawn ? 0 : (p.totalSalary || 0)), 0);
    const updatedIds = payrolls.filter((p) => !p.withdrawn).map((p) => p._id);

    const remaining = await Payroll.aggregate([
      { $match: { user: payrolls[0].user, withdrawn: false } },
      { $group: { _id: null, total: { $sum: "$totalSalary" } } },
    ]);

    const withdrawal = new Withdrawal({
      userId: payrolls[0].user,
      payrollIds: updatedIds,
      amount: total,
      remaining: (remaining[0] && remaining[0].total) || 0,
      weekRange,
      createdBy: initiatedBy,
      status: "pending",
    });
    await withdrawal.save();

    if (global.io) {
      global.io.emit("withdrawalRequested", { withdrawalId: withdrawal._id, userId: withdrawal.userId, amount: withdrawal.amount });
    }

    res.json({
      success: true,
      message: `✅ Withdrawal request submitted for ₱${total.toFixed(2)}. Awaiting admin approval.`,
      withdrawal,
    });
  } catch (err) {
    console.error("❌ Bulk withdraw error:", err);
    res.status(500).json({ message: "Failed to bulk withdraw" });
  }
});

router.get("/withdrawals/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const withdrawals = await Withdrawal.find({ userId })
      .populate("userId", "username name role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, withdrawals });
  } catch (err) {
    console.error("❌ Error fetching withdrawals:", err);
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
});

router.get("/withdrawals", async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find()
      .populate("userId", "username name role")
      .populate("approvedBy", "username name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, withdrawals });
  } catch (err) {
    console.error("❌ Error fetching all withdrawals:", err);
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
});

/* ========================================================
   ✅ ADMIN: Approve Withdrawal Request
======================================================== */
router.put("/withdrawals/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    const withdrawal = await Withdrawal.findById(id).populate("userId");
    if (!withdrawal) return res.status(404).json({ message: "Withdrawal not found" });
    
    if (withdrawal.status !== "pending") {
      return res.status(400).json({ message: `Withdrawal already ${withdrawal.status}` });
    }

    // Update withdrawal status
    withdrawal.status = "approved";
    withdrawal.approvedBy = adminId;
    withdrawal.approvedAt = new Date();
    await withdrawal.save();

    // Mark payrolls as withdrawn
    const payrolls = await Payroll.find({ _id: { $in: withdrawal.payrollIds } });
    for (const payroll of payrolls) {
      payroll.withdrawn = true;
      payroll.withdrawnAt = new Date();
      payroll.withdrawal = withdrawal.amount;
      await payroll.save();
    }

    // 🔄 Notify user
    if (global.io) {
      global.io.emit("withdrawalApproved", { 
        withdrawalId: withdrawal._id,
        userId: withdrawal.userId._id,
        amount: withdrawal.amount
      });
    }

    res.json({
      success: true,
      message: "✅ Withdrawal approved successfully",
      withdrawal,
    });
  } catch (err) {
    console.error("❌ Error approving withdrawal:", err);
    res.status(500).json({ message: "Failed to approve withdrawal" });
  }
});

/* ========================================================
   ❌ ADMIN: Reject Withdrawal Request
======================================================== */
router.put("/withdrawals/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId, reason } = req.body;

    const withdrawal = await Withdrawal.findById(id).populate("userId");
    if (!withdrawal) return res.status(404).json({ message: "Withdrawal not found" });
    
    if (withdrawal.status !== "pending") {
      return res.status(400).json({ message: `Withdrawal already ${withdrawal.status}` });
    }

    // Update withdrawal status
    withdrawal.status = "rejected";
    withdrawal.approvedBy = adminId;
    withdrawal.approvedAt = new Date();
    withdrawal.rejectionReason = reason || "No reason provided";
    await withdrawal.save();

    // Ensure any payrolls linked remain available (revert flags if any were set previously)
    try {
      const payrolls = await Payroll.find({ _id: { $in: withdrawal.payrollIds } });
      for (const p of payrolls) {
        if (p.withdrawn) {
          p.withdrawn = false;
          p.withdrawnAt = undefined;
          p.withdrawal = 0;
          await p.save();
        }
      }
    } catch (e) {
      console.warn("⚠️ Failed to revert payroll withdrawn flags on rejection:", e.message);
    }

    // 🔄 Notify user
    if (global.io) {
      global.io.emit("withdrawalRejected", { 
        withdrawalId: withdrawal._id,
        userId: withdrawal.userId._id,
        reason: withdrawal.rejectionReason
      });
    }

    res.json({
      success: true,
      message: "❌ Withdrawal rejected",
      withdrawal,
    });
  } catch (err) {
    console.error("❌ Error rejecting withdrawal:", err);
    res.status(500).json({ message: "Failed to reject withdrawal" });
  }
});

/* ========================================================
   📋 ADMIN: Get Pending Withdrawal Requests
======================================================== */
router.get("/withdrawals/pending", async (req, res) => {
  try {
    const pending = await Withdrawal.find({ status: "pending" })
      .populate("userId", "username name role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, withdrawals: pending, count: pending.length });
  } catch (err) {
    console.error("❌ Error fetching pending withdrawals:", err);
    res.status(500).json({ message: "Failed to fetch pending withdrawals" });
  }
});

/* ========================================================
   💰 SYNC TELLER REPORTS TO PAYROLL (accumulate over/short)
======================================================== */
router.post("/sync-teller-reports", async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // Default to current month if no dates provided
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    // Find all teller reports for this user in the date range
    // Reports store `date` as string (yyyy-mm-dd) and also have `createdAt` timestamp;
    // using `createdAt` when start/end are Date objects is more reliable and avoids type mismatches.
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

    const reports = await TellerReport.find({
      tellerId: userId,
      createdAt: { $gte: startDay, $lte: endDay }
    }).lean();

    // Calculate totals
    const totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
    // For short amounts with payment terms, treat the report short as contribution toward weekly installment
    const totalShort = reports.reduce((sum, r) => {
      const shortAmount = Number(r.short) || 0;
      const terms = Number(r.shortPaymentTerms) || 1;
      return sum + (shortAmount / terms);
    }, 0);

    // Find ALL payroll entries for this user in this period (to handle duplicates)
    const existingPayrolls = await Payroll.find({
      user: userId,
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: 1 });

    // Always read current user to keep baseSalary in sync
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate accumulated base salary (daily base × days worked)
    const daysWorked = reports.length;
    const accumulatedBase = daysWorked * (user.baseSalary || 0);

    // Ensure we have a consistent date field on payrolls (yyyy-mm-dd) for UI filtering
    const dateKey = startDay.toISOString().split('T')[0];

    let payroll;
    let deletedCount = 0;

    if (existingPayrolls.length === 0) {
      // Create new payroll entry
      payroll = new Payroll({
        user: userId,
        role: user.role,
        baseSalary: accumulatedBase,
        over: totalOver,
        short: totalShort,
        deduction: 0,
        withdrawal: 0,
        daysPresent: daysWorked,
        date: dateKey,
      });
    } else if (existingPayrolls.length === 1) {
      // Single entry - just update it
      payroll = existingPayrolls[0];
      payroll.over = totalOver;
      payroll.short = totalShort;
      payroll.baseSalary = accumulatedBase;
      payroll.daysPresent = daysWorked;
      payroll.date = dateKey;
      if (!payroll.role && user.role) payroll.role = user.role;
    } else {
      // Multiple entries found - consolidate into the oldest one
      console.warn(`⚠️  Found ${existingPayrolls.length} payroll entries for user ${user.username} (${dateKey}). Consolidating...`);
      
      payroll = existingPayrolls[0]; // Keep the oldest
      payroll.over = totalOver;
      payroll.short = totalShort;
      payroll.baseSalary = accumulatedBase;
      payroll.daysPresent = daysWorked;
      payroll.date = dateKey;
      if (!payroll.role && user.role) payroll.role = user.role;

      // Delete all other duplicates
      for (let i = 1; i < existingPayrolls.length; i++) {
        await Payroll.deleteOne({ _id: existingPayrolls[i]._id });
        deletedCount++;
      }
    }

    // Calculate total salary using weekly semantics (totalShort here is already a weekly installment sum)
    payroll.totalSalary = computeTotalSalary({
      baseSalary: payroll.baseSalary,
      over: totalOver,
      short: totalShort,
      deduction: payroll.deduction || 0,
      withdrawal: payroll.withdrawal || 0,
      shortIsInstallment: true
    }, { period: "weekly" });

    await payroll.save();

    // Emit real-time update
    if (global.io) {
      global.io.emit("payrollUpdated", { userId, payrollId: payroll._id });
    }

    res.json({
      success: true,
      message: `✅ Payroll synced with teller reports${deletedCount > 0 ? ` (removed ${deletedCount} duplicate entries)` : ''}`,
      payroll,
      reportsProcessed: reports.length,
      totalOver,
      totalShort,
      duplicatesRemoved: deletedCount
    });

  } catch (err) {
    console.error("❌ Error syncing teller reports to payroll:", err);
    res.status(500).json({ message: "Failed to sync teller reports" });
  }
});

/* ========================================================
   � ADMIN: SYNC ALL TELLERS THIS MONTH (refresh base + totals)
   Useful if some payrolls were created with baseSalary=0 earlier.
======================================================== */
router.post("/sync-month-all", async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const users = await User.find({ role: { $in: ["teller", "supervisor", "supervisor_teller"] } }).lean();
    let processed = 0;
    let errors = 0;

    for (const u of users) {
      try {
        // Sum reports for tellers and supervisor_tellers; supervisors don't accumulate over/short
        let totalOver = 0;
        let totalShort = 0;
        let daysWorked = 0;
        
        if (u.role === "teller" || u.role === "supervisor_teller") {
          const reports = await TellerReport.find({
            tellerId: u._id,
            date: { $gte: start, $lte: end },
          }).lean();
          totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
          totalShort = reports.reduce((sum, r) => sum + (Number(r.short) || 0), 0);
          daysWorked = reports.length;
        }

        // Calculate accumulated base salary (daily base × days worked)
        // For supervisor_teller with reports: use teller base salary
        let dailyBase = Number(u.baseSalary || 0);
        if (u.role === "supervisor_teller" && daysWorked > 0) {
          // When supervisor_teller has teller reports, they should earn teller base
          const settings = await SystemSettings.findOne().lean();
          dailyBase = settings?.baseSalary?.teller || 450;
        }
        const accumulatedBase = daysWorked * dailyBase;

        // Find ALL payroll entries for this user in this month (to handle duplicates)
        const existingPayrolls = await Payroll.find({ 
          user: u._id, 
          createdAt: { $gte: start, $lte: end } 
        }).sort({ createdAt: 1 });

        let payroll;
        let deletedCount = 0;

        if (existingPayrolls.length === 0) {
          payroll = new Payroll({
            user: u._id,
            role: u.role,
            baseSalary: accumulatedBase,
            over: totalOver,
            short: totalShort,
            deduction: 0,
            withdrawal: 0,
            daysPresent: daysWorked,
          });
        } else if (existingPayrolls.length === 1) {
          // Single entry - just update it
          payroll = existingPayrolls[0];
          payroll.over = totalOver;
          payroll.short = totalShort;
          payroll.baseSalary = accumulatedBase;
          payroll.daysPresent = daysWorked;
          if (!payroll.role && u.role) payroll.role = u.role;
        } else {
          // Multiple entries found - consolidate into the oldest one
          console.warn(`⚠️  Found ${existingPayrolls.length} payroll entries for user ${u.username} (${u._id}). Consolidating...`);
          
          payroll = existingPayrolls[0]; // Keep the oldest
          payroll.over = totalOver;
          payroll.short = totalShort;
          payroll.baseSalary = accumulatedBase;
          payroll.daysPresent = daysWorked;
          if (!payroll.role && u.role) payroll.role = u.role;

          // Delete all other duplicates
          for (let i = 1; i < existingPayrolls.length; i++) {
            await Payroll.deleteOne({ _id: existingPayrolls[i]._id });
            deletedCount++;
          }
        }

        // Calculate total salary for month-level payrolls using monthly semantics
        payroll.totalSalary = computeTotalSalary({
          baseSalary: payroll.baseSalary,
          over: payroll.over || 0,
          short: payroll.short || 0,
          deduction: payroll.deduction || 0,
          withdrawal: payroll.withdrawal || 0
        }, { period: "monthly" });
        await payroll.save();
        processed += 1;

        if (global.io) {
          global.io.emit("payrollUpdated", { userId: u._id, payrollId: payroll._id });
        }
      } catch (e) {
        console.warn("⚠️ Sync failed for user", u._id, e?.message);
        errors += 1;
      }
    }

    res.json({ success: true, processed, errors });
  } catch (err) {
    console.error("❌ sync-month-all error:", err);
    res.status(500).json({ message: "Failed to sync all payrolls" });
  }
});

/* ========================================================
   ⏪ SYNC YESTERDAY'S CAPITAL → PAYROLL BASES
   - Ensures tellers and their supervisors who had capital added yesterday
     have a payroll entry this month with correct baseSalary.
======================================================== */
router.post("/sync-yesterday-capital", async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Compute yesterday (Asia/Manila friendly approximation using system tz)
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);

    // Find capital records created yesterday
    const caps = await Capital.find({
      createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
    }).lean();

    if (!caps || caps.length === 0) {
      return res.json({ success: true, processed: 0, message: "No capital records from yesterday" });
    }

    let processed = 0;
    let errors = 0;

    for (const c of caps) {
      try {
        // TELLER payroll ensure
        const teller = await User.findById(c.tellerId).lean();
        if (teller) {
          let p = await Payroll.findOne({ user: teller._id, createdAt: { $gte: monthStart, $lte: monthEnd } });
          if (!p) {
            p = new Payroll({
              user: teller._id,
              role: teller.role,
              baseSalary: teller.baseSalary || 0,
              over: 0,
              short: 0,
              deduction: 0,
              withdrawal: 0,
            });
          } else {
            // Keep base synchronized
            if ((p.baseSalary || 0) !== (teller.baseSalary || 0)) p.baseSalary = teller.baseSalary || 0;
            if (!p.role && teller.role) p.role = teller.role;
          }
          // Calculate total salary using monthly semantics
          p.totalSalary = computeTotalSalary({
            baseSalary: p.baseSalary || 0,
            over: p.over || 0,
            short: p.short || 0,
            deduction: p.deduction || 0,
            withdrawal: p.withdrawal || 0
          }, { period: 'monthly' });
          await p.save();
          processed++;
          if (global.io) global.io.emit("payrollUpdated", { userId: teller._id, payrollId: p._id });
        }

        // SUPERVISOR payroll ensure
        const supervisor = await User.findById(c.supervisorId).lean();
        if (supervisor && supervisor.role === "supervisor") {
          let sp = await Payroll.findOne({ user: supervisor._id, createdAt: { $gte: monthStart, $lte: monthEnd } });
          if (!sp) {
            sp = new Payroll({
              user: supervisor._id,
              role: supervisor.role,
              baseSalary: supervisor.baseSalary || 0,
              over: 0,
              short: 0,
              deduction: 0,
              withdrawal: 0,
            });
          } else {
            if ((sp.baseSalary || 0) !== (supervisor.baseSalary || 0)) sp.baseSalary = supervisor.baseSalary || 0;
            if (!sp.role) sp.role = supervisor.role;
            // supervisors: ensure no over/short counted here
            sp.over = 0;
            sp.short = 0;
          }
          sp.totalSalary = computeTotalSalary({
            baseSalary: sp.baseSalary || 0,
            over: sp.over || 0,
            short: sp.short || 0,
            deduction: sp.deduction || 0,
            withdrawal: sp.withdrawal || 0
          }, { period: 'monthly' });
          await sp.save();
          processed++;
          if (global.io) global.io.emit("payrollUpdated", { userId: supervisor._id, payrollId: sp._id });
        }
      } catch (e) {
        console.warn("⚠️ sync-yesterday-capital error for cap", c?._id, e?.message || e);
        errors++;
      }
    }

    res.json({ success: true, processed, errors });
  } catch (err) {
    console.error("❌ sync-yesterday-capital failed:", err);
    res.status(500).json({ message: "Failed to sync yesterday capital" });
  }
});

/* ========================================================
   🔁 ADMIN: Backfill/Recalculate payroll totals (base + over - short/terms - deduction - withdrawal)
   Optional body: { startDate, endDate } to limit scope (ISO date strings)
   Restricted to admin/super_admin
======================================================== */
router.post("/backfill-recalculate", requireAuth, requireRole(['admin','super_admin']), async (req, res) => {
  try {
    const { startDate, endDate } = req.body || {};

    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const payrolls = await Payroll.find(filter).lean();
    if (!payrolls || payrolls.length === 0) {
      return res.json({ success: true, processed: 0, message: "No payrolls found to backfill" });
    }

    let processed = 0;
    const errors = [];

    for (const p of payrolls) {
      try {
        const payroll = await Payroll.findById(p._id);
        if (!payroll) continue;

        // Ensure baseSalary exists: prefer existing, fallback to user's baseSalary
        if (!payroll.baseSalary || payroll.baseSalary === 0) {
          const u = await User.findById(payroll.user).lean();
          payroll.baseSalary = u ? (u.baseSalary || 0) : (payroll.baseSalary || 0);
        }

        // Recalculate using weekly semantics and payment terms (payroll.short is expected to be the full short amount here)
        payroll.totalSalary = computeTotalSalary({
          baseSalary: payroll.baseSalary || 0,
          over: payroll.over || 0,
          short: payroll.short || 0,
          deduction: payroll.deduction || 0,
          withdrawal: payroll.withdrawal || 0,
          shortPaymentTerms: payroll.shortPaymentTerms || 1,
          shortIsInstallment: false
        }, { period: 'weekly' });

        await payroll.save();
        processed++;
        if (global.io) global.io.emit("payrollUpdated", { userId: payroll.user, payrollId: payroll._id });
      } catch (e) {
        errors.push({ id: p._id, msg: e.message });
      }
    }

    res.json({ success: true, processed, errors });
  } catch (err) {
    console.error("❌ backfill-recalculate failed:", err);
    res.status(500).json({ message: "Failed to backfill payrolls", error: err.message });
  }
});

/* ========================================================
   �🧾 PAYROLL ADMIN MANAGEMENT
======================================================== */
router.put("/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found" });

    payroll.approved = true;
    payroll.approvedAt = new Date();
    await payroll.save();

    if (global.io) global.io.emit("payrollApproved", { payrollId: id, adminId });

    res.json({ success: true, message: "✅ Payroll approved", payroll });
  } catch (err) {
    console.error("❌ Approve error:", err);
    res.status(500).json({ message: "Failed to approve payroll" });
  }
});

router.put("/:id/disapprove", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found" });

    // Check if payroll is locked
    if (payroll.locked) {
      return res.status(400).json({ message: "Cannot disapprove locked payroll. Unlock it first." });
    }

    payroll.approved = false;
    payroll.approvedAt = null;
    await payroll.save();

    if (global.io) global.io.emit("payrollDisapproved", { payrollId: id, adminId });

    res.json({ success: true, message: "✅ Payroll set to pending", payroll });
  } catch (err) {
    console.error("❌ Disapprove error:", err);
    res.status(500).json({ message: "Failed to disapprove payroll" });
  }
});

router.put("/:id/adjust", async (req, res) => {
  try {
    const { id } = req.params;
    const { delta = 0, baseSalary = null, reason = "", adminId = null, overrideDate = null, shortPaymentTerms = null } = req.body;

    const payroll = await Payroll.findById(id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found" });

    // If overrideDate is provided and different from current date, update the payroll date
    if (overrideDate) {
      const newDate = new Date(overrideDate);
      // Set time to match original payroll time to preserve timezone consistency
      const originalTime = new Date(payroll.createdAt);
      newDate.setHours(originalTime.getHours(), originalTime.getMinutes(), originalTime.getSeconds());
      payroll.createdAt = newDate;

      // Ensure payroll.date field is set as a YYYY-MM-DD string so frontend can reliably filter
      try {
        payroll.date = newDate.toISOString().split('T')[0];
      } catch (e) {
        // fallback — leave payroll.date unchanged if any error
        console.warn('⚠️ Failed to set payroll.date from overrideDate:', e?.message || e);
      }
    }

    // If shortPaymentTerms is provided, update it
    if (shortPaymentTerms !== null && !isNaN(shortPaymentTerms)) {
      payroll.shortPaymentTerms = Number(shortPaymentTerms);
    }

    // If baseSalary is provided, update it and recalculate totalSalary
    if (baseSalary !== null && !isNaN(baseSalary)) {
      const oldBaseSalary = payroll.baseSalary || 0;
      const newBaseSalary = Number(baseSalary);
      payroll.baseSalary = newBaseSalary;
      
      // ⚠️ IMPORTANT: When updating base salary, DO NOT re-add over/short
      // Over and short are already factored into the current totalSalary
      // Only calculate the difference in base salary and apply it to totalSalary
      const oldTotal = payroll.totalSalary || 0;
      const baseSalaryDifference = newBaseSalary - oldBaseSalary;
      payroll.totalSalary = oldTotal + baseSalaryDifference;
      
      // Add adjustment note about base salary change
      if (oldBaseSalary !== newBaseSalary) {
        payroll.adjustments.push({
          delta: baseSalaryDifference,
          reason: `Base salary changed from ₱${oldBaseSalary} to ₱${newBaseSalary}. ${reason}`,
          adminId,
        });
      }
    } else if (shortPaymentTerms !== null) {
      // If only shortPaymentTerms changed, recalculate totalSalary
      const baseSal = payroll.baseSalary || 0;
      const over = payroll.over || 0;
      const short = payroll.short || 0;
      const deduction = payroll.deduction || 0;
      const terms = payroll.shortPaymentTerms || 1;
      const weeklyShortDeduction = short / terms;
      const newTotal = baseSal + over - weeklyShortDeduction - deduction;
      
      console.log(`📊 Recalculating totalSalary for payroll ${id}:`);
      console.log(`   Base: ₱${baseSal}, Over: ₱${over}, Short: ₱${short}, Deduction: ₱${deduction}`);
      console.log(`   Terms: ${terms} weeks, Weekly Short: ₱${weeklyShortDeduction.toFixed(2)}`);
      console.log(`   Old Total: ₱${payroll.totalSalary}, New Total: ₱${newTotal.toFixed(2)}`);
      
      payroll.totalSalary = newTotal;
      
      // Add note about payment terms adjustment
      if (reason) {
        payroll.adjustments.push({
          delta: 0,
          reason: `Payment terms changed to ${terms} weeks. ${reason}`,
          adminId,
        });
      }
    }

    // Apply delta adjustment
    if (delta !== 0) {
      payroll.totalSalary = (payroll.totalSalary || 0) + Number(delta);
      payroll.adjustments.push({
        delta: Number(delta),
        reason,
        adminId,
      });
    }

    await payroll.save();

    if (global.io) global.io.emit("payrollAdjusted", { payrollId: id });

    res.json({ success: true, message: "✅ Payroll adjusted", payroll });
  } catch (err) {
    console.error("❌ Adjustment error:", err);
    res.status(500).json({ message: "Failed to adjust payroll" });
  }
});

/**
 * POST /api/payroll/create-override
 * Super admin creates a new payroll entry with custom values
 */
router.post("/create-override", async (req, res) => {
  try {
    const { userId, date, baseSalary, over = 0, short = 0, shortPaymentTerms = 1, reason, role, adminId } = req.body;

    if (!userId || !date || !baseSalary || !reason) {
      return res.status(400).json({ message: "Missing required fields: userId, date, baseSalary, reason" });
    }

    // Check if payroll already exists for this user on this date
    const existingPayroll = await Payroll.findOne({
      user: userId,
      createdAt: {
        $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(date).setHours(23, 59, 59, 999))
      }
    });

    if (existingPayroll) {
      return res.status(400).json({ 
        message: "A payroll entry already exists for this user on this date. Please use the adjust feature instead." 
      });
    }

    // For admin override: include over/short in calculation since admin explicitly sets these values
    const totalSalary = Number(baseSalary) + Number(over) - Number(short);

    const newPayroll = new Payroll({
      user: userId,
      role: role || 'teller',
      baseSalary: Number(baseSalary),
      over: Number(over),
      short: Number(short),
      shortPaymentTerms: Number(shortPaymentTerms) || 1,
      totalSalary: totalSalary,
      deduction: 0,
      daysPresent: 1,
      approved: false,
      createdAt: new Date(date),
      adjustments: [{
        delta: 0,
        reason: `[CREATED BY OVERRIDE] ${reason}`,
        adminId: adminId,
        createdAt: new Date()
      }]
    });

    await newPayroll.save();

    if (global.io) global.io.emit("payrollAdjusted", { payrollId: newPayroll._id });

    res.json({ success: true, message: "✅ Payroll override created", payroll: newPayroll });
  } catch (err) {
    console.error("❌ Create override error:", err);
    res.status(500).json({ message: "Failed to create payroll override" });
  }
});

/* ========================================================
   🔐 SUPER ADMIN: Withdraw ALL payroll overrides (one-shot)
   - If userId is provided: withdraw only overrides for that user.
   - Otherwise: find ALL payrolls that were created via override and are not withdrawn,
     create per-user withdrawal records and mark payrolls withdrawn (approved by super_admin).
   - Only role: super_admin
======================================================== */
router.post(
  "/withdraw-all-overrides",
  requireAuth,
  requireRole(["super_admin"]),
  async (req, res) => {
    try {
      const { userId = null, weekRange = null } = req.body;
      const matchBase = { withdrawn: false, "adjustments.reason": /CREATED BY OVERRIDE/i };
      if (userId) matchBase.user = userId;

      let payrolls = await Payroll.find(matchBase).lean();

      // Safety filters: skip admin/super_admin payrolls and payrolls with non-positive totals
      payrolls = payrolls.filter((p) => p.role !== "admin" && p.role !== "super_admin" && (p.totalSalary || 0) > 0);

      // Safety cap to avoid accidental mass operations
      const MAX_BATCH = Number(process.env.MAX_WITHDRAW_BATCH || 500);
      if (payrolls.length > MAX_BATCH) {
        return res.status(400).json({ success: false, message: `Too many payrolls to withdraw at once (${payrolls.length}). Use a smaller scope or set MAX_WITHDRAW_BATCH.` });
      }

      if (!payrolls || payrolls.length === 0)
        return res.json({ success: true, message: "No override payrolls found to withdraw", count: 0 });

      // Group payrolls by user to create per-user withdrawals
      const byUser = payrolls.reduce((acc, p) => {
        const uid = String(p.user);
        if (!acc[uid]) acc[uid] = [];
        acc[uid].push(p);
        return acc;
      }, {});

      const createdWithdrawals = [];

      for (const [uid, pList] of Object.entries(byUser)) {
        const payrollIds = pList.map((p) => p._id);
        const total = pList.reduce((s, pp) => s + (pp.totalSalary || 0), 0);

        // Build Withdrawal doc in APPROVED state since a super_admin is performing this
        const withdrawal = new Withdrawal({
          userId: uid,
          payrollIds,
          amount: total,
          remaining: 0,
          weekRange,
          createdBy: req.user ? req.user._id : null,
          status: "approved",
          approvedBy: req.user ? req.user._id : null,
          approvedAt: new Date(),
        });

        await withdrawal.save();

        // Mark payrolls as withdrawn and attach the withdrawal amount
        await Payroll.updateMany(
          { _id: { $in: payrollIds } },
          { $set: { withdrawn: true, withdrawnAt: new Date(), withdrawal: total } }
        );

        // Notify in real-time if socket exists
        if (global.io) global.io.emit("withdrawalApproved", { withdrawalId: withdrawal._id, userId: uid, amount: withdrawal.amount });

        createdWithdrawals.push({ withdrawalId: withdrawal._id, userId: uid, amount: total, payrollCount: payrollIds.length });
      }

      res.json({ success: true, message: `✅ Withdrawn ${payrolls.length} override payroll(s)`, withdrawals: createdWithdrawals });
    } catch (err) {
      console.error("❌ withdraw-all-overrides error:", err);
      res.status(500).json({ message: "Failed to withdraw override payrolls" });
    }
  }
);

/**
 * GET /api/payroll/unapproved
 */
router.get("/unapproved", async (req, res) => {
  try {
    const unapproved = await Payroll.find({ approved: false })
      .populate("user", "username name role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, unapproved });
  } catch (err) {
    console.error("❌ Fetch unapproved error:", err);
    res.status(500).json({ message: "Failed to fetch unapproved payrolls" });
  }
});

/* ========================================================
   ✅ STABLE: Get single payroll by ID (SidebarLayout.jsx)
======================================================== */
router.get("/:id", async (req, res) => {
  try {
    const payrollId = req.params.id;
    console.log("📥 Fetching payroll by ID:", payrollId);

    if (!payrollId || payrollId.length < 10) {
      return res.status(400).json({ message: "Invalid payroll ID format" });
    }

    const payroll = await Payroll.findById(payrollId)
      .populate("user", "username name role status")
      .lean();

    if (!payroll) {
      console.warn("⚠️ Payroll not found for ID:", payrollId);
      return res.status(404).json({ message: "Payroll not found" });
    }

    res.json({ success: true, payroll });
  } catch (err) {
    console.error("❌ Error fetching payroll by ID:", err);
    res.status(500).json({ message: "Failed to fetch payroll", error: err.message });
  }
});

/* ========================================================
   🗑️ DELETE: Delete a payroll record (Super Admin only)
======================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const payrollId = req.params.id;
    console.log("🗑️ Deleting payroll ID:", payrollId);

    if (!payrollId || payrollId.length < 10) {
      return res.status(400).json({ message: "Invalid payroll ID format" });
    }

    const payroll = await Payroll.findById(payrollId);

    if (!payroll) {
      console.warn("⚠️ Payroll not found for deletion:", payrollId);
      return res.status(404).json({ message: "Payroll not found" });
    }

    // Optional: Check if payroll is locked
    if (payroll.locked) {
      return res.status(400).json({ message: "Cannot delete locked payroll. Unlock it first." });
    }

    await Payroll.findByIdAndDelete(payrollId);
    console.log("✅ Payroll deleted successfully:", payrollId);

    res.json({ success: true, message: "Payroll deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting payroll:", err);
    res.status(500).json({ message: "Failed to delete payroll", error: err.message });
  }
});

/* ========================================================
   🔍 CHECK: Users without base salary
======================================================== */
router.get("/check/no-base-salary", requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    // Find all users without base salary (baseSalary is 0, null, or undefined)
    const usersWithoutBaseSalary = await User.find({
      $or: [
        { baseSalary: { $exists: false } },
        { baseSalary: null },
        { baseSalary: 0 }
      ],
      role: 'teller', // Only check tellers
      active: true
    })
    .select('username name email role baseSalary active')
    .sort({ username: 1 })
    .lean();

    // Get their latest payroll records
    const usersWithPayrolls = await Promise.all(
      usersWithoutBaseSalary.map(async (user) => {
        const latestPayroll = await Payroll.findOne({ user: user._id })
          .select('baseSalary totalSalary createdAt')
          .sort({ createdAt: -1 })
          .lean();
        
        return {
          ...user,
          latestPayroll: latestPayroll || null
        };
      })
    );

    console.log(`✅ Found ${usersWithPayrolls.length} users without base salary`);
    
    res.json({ 
      success: true, 
      count: usersWithPayrolls.length,
      users: usersWithPayrolls 
    });
  } catch (err) {
    console.error("❌ Error checking users without base salary:", err);
    res.status(500).json({ message: "Failed to check users without base salary", error: err.message });
  }
});

// Clean up duplicate payroll records for the same day
router.post("/cleanup/duplicates", requireAuth, async (req, res) => {
  try {
    const { daysBack = 7 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Find all payroll records in the date range
    const payrolls = await Payroll.find({
      createdAt: { $gte: cutoffDate }
    }).sort({ user: 1, createdAt: -1 });

    // Group by user and date (ignoring time)
    const grouped = {};
    payrolls.forEach((payroll) => {
      const dateKey = payroll.createdAt.toISOString().split("T")[0];
      const userKey = `${payroll.user}-${dateKey}`;

      if (!grouped[userKey]) {
        grouped[userKey] = [];
      }
      grouped[userKey].push(payroll);
    });

    let totalDeleted = 0;
    const deletedDetails = [];

    // For each user-date combination with duplicates
    for (const userKey in grouped) {
      if (grouped[userKey].length > 1) {
        // Sort by createdAt descending (newest first)
        const records = grouped[userKey].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const keepRecord = records[0]; // Keep the newest
        const deleteRecords = records.slice(1); // Delete the rest

        for (const record of deleteRecords) {
          await Payroll.findByIdAndDelete(record._id);
          totalDeleted++;
          deletedDetails.push({
            userId: keepRecord.user,
            date: userKey,
            deletedId: record._id.toString(),
            keptId: keepRecord._id.toString(),
            deletedAmount: record.totalSalary,
            keptAmount: keepRecord.totalSalary
          });
        }
      }
    }

    console.log(`✅ Cleaned up ${totalDeleted} duplicate payroll records`);
    res.json({
      success: true,
      message: `Deleted ${totalDeleted} duplicate payroll records from past ${daysBack} days`,
      totalDeleted,
      details: deletedDetails
    });
  } catch (err) {
    console.error("❌ Error cleaning up duplicates:", err);
    res.status(500).json({ message: "Failed to clean up duplicates", error: err.message });
  }
});

// Recalculate payroll totals with newly fixed salaries
router.post("/recalculate/with-fixed-salaries", requireAuth, async (req, res) => {
  try {
    const { userIds = null, daysBack = 30 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Build query
    let payrollQuery = { createdAt: { $gte: cutoffDate } };
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      payrollQuery.user = { $in: userIds };
    }

    // Get payroll records to recalculate
    const payrolls = await Payroll.find(payrollQuery).populate("user");

    if (payrolls.length === 0) {
      return res.json({
        success: true,
        message: "No payroll records found to recalculate",
        totalRecalculated: 0
      });
    }

    let totalRecalculated = 0;
    const recalculatedDetails = [];

    for (const payroll of payrolls) {
      const user = payroll.user;
      if (!user) continue;

      const oldBaseSalary = payroll.baseSalary;
      const oldTotalSalary = payroll.totalSalary;

      // Only update base salary if user's current salary is NOT zero
      // This prevents zeroing out previously recorded salaries
      if (user.baseSalary && user.baseSalary > 0) {
        payroll.baseSalary = user.baseSalary;
      }
      // If user's salary is 0/null, keep the existing payroll base salary

      // Recalculate total salary
      let newTotalSalary = payroll.baseSalary;

      // Add "over" (bonus/extra earnings)
      if (payroll.over) {
        newTotalSalary += payroll.over;
      }

      // Subtract "short" (deduction for shortfall)
      if (payroll.short) {
        newTotalSalary -= payroll.short;
      }

      // Subtract deduction
      if (payroll.deduction) {
        newTotalSalary -= payroll.deduction;
      }

      // Subtract withdrawal
      if (payroll.withdrawal) {
        newTotalSalary -= payroll.withdrawal;
      }

      // Add/subtract admin adjustments
      if (payroll.adjustments && Array.isArray(payroll.adjustments)) {
        newTotalSalary += payroll.adjustments.reduce((sum, a) => sum + (a.delta || 0), 0);
      }

      payroll.totalSalary = newTotalSalary;

      // Mark as modified for subdocuments
      payroll.markModified("baseSalary");
      payroll.markModified("totalSalary");

      await payroll.save();
      totalRecalculated++;

      recalculatedDetails.push({
        userId: payroll.user._id.toString(),
        payrollId: payroll._id.toString(),
        oldBaseSalary,
        newBaseSalary: payroll.baseSalary,
        oldTotalSalary,
        newTotalSalary: payroll.totalSalary,
        difference: payroll.totalSalary - oldTotalSalary
      });
    }

    console.log(`✅ Recalculated ${totalRecalculated} payroll records with fixed salaries`);
    res.json({
      success: true,
      message: `Recalculated ${totalRecalculated} payroll records with fixed salaries`,
      totalRecalculated,
      details: recalculatedDetails
    });
  } catch (err) {
    console.error("❌ Error recalculating payrolls:", err);
    res.status(500).json({ message: "Failed to recalculate payrolls", error: err.message });
  }
});

export default router;
