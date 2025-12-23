import express from "express";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import { requireAuth, requireRole } from "../middleware/auth.js";
import Capital from "../models/Capital.js";
import TellerManagementModel from "../models/TellerManagementModel.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Payroll from "../models/Payroll.js";
import DailyTellerAssignment from "../models/DailyTellerAssignment.js";
import ShortPayment from "../models/ShortPayment.js";

const router = express.Router();

/**
 * Helper function: Apply active payment plans to a new payroll
 * Automatically deducts weekly amounts from active short payment plans
 */
async function applyPaymentPlansToPayroll(userId, payroll) {
  try {
    // Find all active payment plans for this user
    const activePlans = await ShortPayment.find({
      userId,
      status: "active",
    });

    if (activePlans.length === 0) return payroll;

    // Calculate total weekly deduction
    let totalWeeklyDeduction = 0;
    const deductionDetails = [];

    for (const plan of activePlans) {
      // Record this payment
      plan.weeksPaid += 1;
      plan.payments.push({
        payrollId: payroll._id,
        amount: plan.weeklyAmount,
        weekNumber: plan.weeksPaid,
        paidAt: new Date(),
      });

      // Check if plan is completed
      if (plan.weeksPaid >= plan.weeksTotal) {
        plan.status = "completed";
      }

      await plan.save();

      totalWeeklyDeduction += plan.weeklyAmount;
      deductionDetails.push({
        planId: plan._id,
        amount: plan.weeklyAmount,
        week: plan.weeksPaid,
        totalWeeks: plan.weeksTotal,
      });
    }

    // Apply deduction to payroll
    if (totalWeeklyDeduction > 0) {
      payroll.deduction = (payroll.deduction || 0) + totalWeeklyDeduction;
      payroll.totalSalary = (payroll.totalSalary || 0) - totalWeeklyDeduction;

      // Add adjustment note
      const detailsStr = deductionDetails
        .map(d => `₱${d.amount.toFixed(2)} (week ${d.week}/${d.totalWeeks})`)
        .join(", ");
      
      payroll.adjustments = payroll.adjustments || [];
      payroll.adjustments.push({
        delta: -totalWeeklyDeduction,
        reason: `Auto-deduction for short payment plan(s): ${detailsStr}`,
        createdAt: new Date(),
      });

      console.log(`✅ Applied payment plan deduction of ₱${totalWeeklyDeduction} to payroll ${payroll._id}`);
    }

    return payroll;
  } catch (err) {
    console.error("❌ Error applying payment plans:", err);
    return payroll; // Return payroll unchanged if error
  }
}


/* ======================================================
   📋 GET AVAILABLE TRANSACTION TYPES FOR TELLER
   ====================================================== */
router.get("/:tellerId/available-transactions", async (req, res) => {
  try {
    const { tellerId } = req.params;

    // Check if teller has any active capital
    const activeCapital = await Capital.findOne({ tellerId, status: "active" });
    
    // Check if teller has any capital transactions
    const hasCapitalTransaction = await Transaction.findOne({ 
      tellerId, 
      type: "capital"
    });

    let availableTypes = [];

    if (!hasCapitalTransaction) {
      // If no capital ever added, only allow capital
      availableTypes = ["capital"];
    } else if (activeCapital) {
      // If has active capital, allow additional and remittance
      availableTypes = ["additional", "remittance"];
    } else {
      // If had capital before but none active, allow capital
      availableTypes = ["capital"];
    }

    res.json({ availableTypes });
  } catch (err) {
    console.error("❌ Error getting available transaction types:", err);
    res.status(500).json({ error: "Failed to get available transaction types" });
  }
});

/* ======================================================
   💰 GET ACTIVE CAPITAL FOR TELLER
   ====================================================== */
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

/* ======================================================
   💰 ADD CAPITAL (SUPERVISOR → TELLER)
   ====================================================== */
router.post("/add-capital", requireAuth, requireRole(['admin', 'super_admin', 'supervisor']), async (req, res) => {
  try {
    const { tellerId, supervisorId, amount, note } = req.body;

    if (!tellerId || !supervisorId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Auto-link teller to supervisor if not yet linked
    const teller = await User.findById(tellerId);
    if (teller && !teller.supervisorId) {
      teller.supervisorId = supervisorId;
      await teller.save();
    }

    // ✅ Close any active capital first
    const active = await Capital.findOne({ tellerId, status: "active" });
    if (active) {
      active.status = "completed";
      await active.save();
    }

    // ✅ Create new active capital
    const newCapital = await Capital.create({
      tellerId,
      supervisorId,
      amount,
      balanceRemaining: amount,
      totalRemitted: 0,
      status: "active",
      note: note || "Initial capital",
      createdAt: new Date(),
    });

    // ✅ Log transaction
    await Transaction.create({
      supervisorId,
      tellerId,
      type: "capital",
      amount,
      performedBy: teller?.name || teller?.username || "Unknown Teller",
      note: "Starting capital provided",
    });

    // ✅ AUTO-ASSIGN: Set teller's supervisorId when capital is added
    try {
      await User.findByIdAndUpdate(tellerId, { supervisorId });
      console.log(`✅ Teller ${tellerId} auto-assigned to supervisor ${supervisorId}`);
    } catch (e) {
      console.warn("⚠️ Failed to auto-assign supervisor:", e?.message || e);
    }

    // ✅ CAPITAL ADDITION SALARY LOGIC
    // When supervisor adds capital to a teller:
    // - Supervisor keeps permanent base salary (600) but gets daily teller rate (450) tracked in shift
    // - Teller keeps permanent base salary (450) but gets daily supervisor rate (600) tracked in shift

    const SystemSettings = (await import('../models/SystemSettings.js')).default;
    const Shift = (await import('../models/Shift.js')).default;
    const settings = await SystemSettings.findOne().lean();
    const tellerBaseSalary = settings?.baseSalaries?.teller || settings?.baseSalary?.teller || 450;
    const supervisorBaseSalary = settings?.baseSalaries?.supervisor || settings?.baseSalary?.supervisor || 600;

    // ✅ SUPERVISOR: Keeps permanent base salary (600) when adding capital on a day
    const supervisor = await User.findById(supervisorId);
    if (supervisor && supervisor.role.includes('supervisor')) {
      // Note: Supervisor keeps their permanent base salary, shift record tracks daily rate

      // ✅ Create shift record to track supervisor working as "teller" role today (gets 450)
      const today = new Date().toISOString().split('T')[0];
      await Shift.findOneAndUpdate(
        { userId: supervisorId, date: today },
        {
          userId: supervisorId,
          assignedRole: supervisor.role,
          roleWorkedAs: 'teller', // Supervisor gets teller rate for adding capital
          date: today,
          baseSalaryUsed: tellerBaseSalary,
        },
        { upsert: true }
      );
      console.log(`✅ Shift record: ${supervisor.name || supervisor.username} working as teller today (₱${tellerBaseSalary})`);
    }

    // ✅ TELLER: Keeps permanent base salary (450) when receiving capital
    if (teller) {
      // Note: Teller keeps their permanent base salary, shift record tracks daily rate

      // ✅ Create shift record to track teller getting supervisor rate today
      const today = new Date().toISOString().split('T')[0];
      await Shift.findOneAndUpdate(
        { userId: tellerId, date: today },
        {
          userId: tellerId,
          assignedRole: teller.role,
          roleWorkedAs: 'supervisor', // Teller gets supervisor rate for receiving capital
          date: today,
          baseSalaryUsed: supervisorBaseSalary,
        },
        { upsert: true }
      );
      console.log(`✅ Shift record: ${teller.name || teller.username} getting supervisor rate today (₱${supervisorBaseSalary})`);
    }

    // ✅ Auto-create payroll for TELLER with base salary (over/short added when report submitted) - DAILY
    try {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      const tellerPayrollExists = await Payroll.findOne({
        user: tellerId,
        createdAt: { $gte: dayStart, $lte: dayEnd },
      }).lean();

      if (!tellerPayrollExists && teller) {
        let tellerPayroll = new Payroll({
          user: tellerId,
          role: teller.role,
          baseSalary: teller.baseSalary || 0,
          over: 0,
          short: 0,
          deduction: 0,
          withdrawal: 0,
          totalSalary: teller.baseSalary || 0,
        });
        
        // Apply active payment plans (auto-deduct weekly amounts)
        tellerPayroll = await applyPaymentPlansToPayroll(tellerId, tellerPayroll);
        
        await tellerPayroll.save();
        if (req.app && req.app.io) {
          req.app.io.emit("payrollUpdated", { userId: tellerId, payrollId: tellerPayroll._id });
        }
        console.log(`✅ Daily base salary payroll created for teller ${tellerId} (${now.toISOString().split('T')[0]})`);
      }
    } catch (e) {
      console.warn("⚠️ Teller base payroll auto-create failed:", e?.message || e);
    }

    // ✅ Ensure supervisor has base-only payroll for TODAY (business rule - daily payroll)
    try {
      const sup = await User.findById(supervisorId).lean();
      if (sup && (sup.role === "supervisor" || sup.role === "supervisor_teller")) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const dayStart = new Date(today + 'T00:00:00.000Z');
        const dayEnd = new Date(today + 'T23:59:59.999Z');

        // Use upsert to prevent duplicate payroll creation (atomic operation)
        let payroll = await Payroll.findOneAndUpdate(
          {
            user: supervisorId,
            date: today // Use date field for uniqueness check
          },
          {
            $setOnInsert: {
              user: supervisorId,
              role: sup.role,
              baseSalary: sup.baseSalary || 0,
              over: 0,
              short: 0,
              deduction: 0,
              withdrawal: 0,
              totalSalary: sup.baseSalary || 0,
              date: today,
            }
          },
          {
            upsert: true,
            new: true, // Return the updated document
            setDefaultsOnInsert: true
          }
        );

        // Apply active payment plans (auto-deduct weekly amounts) - only if this is a new payroll
        if (payroll.createdAt && (Date.now() - payroll.createdAt.getTime()) < 1000) {
          // This is a newly created payroll (less than 1 second old)
          payroll = await applyPaymentPlansToPayroll(supervisorId, payroll);
          await payroll.save();
        }

        if (req.app && req.app.io) {
          req.app.io.emit("payrollUpdated", { userId: supervisorId, payrollId: payroll._id });
        }
        console.log(`✅ Daily base salary payroll ensured for supervisor ${supervisorId} (${today})`);
      }
    } catch (e) {
      console.warn("⚠️ Supervisor base payroll auto-create failed:", e?.message || e);
    }

    // ✅ Ensure a TellerManagement record exists for today (lazy-create on first capital)
    try {
      const dateKey = DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
      const supervisorUser = await User.findById(supervisorId).select("name username").lean();
      await TellerManagementModel.findOneAndUpdate(
        { tellerId, supervisorId, dateKey },
        {
          $setOnInsert: {
            tellerId,
            supervisorId,
            supervisorName: supervisorUser?.name || supervisorUser?.username || "",
            dateKey,
            amount,
            balanceRemaining: amount,
            totalRemitted: 0,
            notes: note || "Initial capital",
            transactions: [],
            status: "active",
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.warn("⚠️ Failed to create teller management record:", e?.message || e);
    }

    // ✅ Live update emit
    if (req.app && req.app.io) {
      req.app.io.emit("tellerManagementUpdated");
      req.app.io.emit("supervisorReportUpdated", { supervisorId });
      req.app.io.emit("transactionUpdated");
      req.app.io.emit("capitalUpdated");
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
   💵 ADDITIONAL CAPITAL (SUPERVISOR)
   ====================================================== */
router.put("/:tellerId/add-capital", requireAuth, requireRole(['admin', 'super_admin', 'supervisor']), async (req, res) => {
  try {
    const { tellerId } = req.params;
    const { amount, note, userId } = req.body;

    // ✅ Validate amount
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0 || isNaN(parsedAmount)) {
      console.error("❌ Invalid amount for additional capital:", amount);
      return res.status(400).json({ error: "Invalid amount. Must be a positive number." });
    }

    const capital = await Capital.findOne({ tellerId, status: "active" });
    if (!capital) {
      return res.status(404).json({ error: "Active capital not found" });
    }

    // ✅ Record the additional capital transaction
    console.log(`💰 Adding additional capital: ₱${parsedAmount} to teller ${tellerId}`);
    await Transaction.create({
      tellerId,
      supervisorId: capital.supervisorId,
      type: "additional",
      amount: parsedAmount,
      note: note || "Additional capital added",
      performedBy: userId,
    });

    // ✅ Update Capital model's totalAdditional
    await Capital.findByIdAndUpdate(
      capital._id,
      { $inc: { totalAdditional: parsedAmount } },
      { new: true }
    );

    if (req.app && req.app.io) {
      req.app.io.emit("tellerManagementUpdated");
      req.app.io.emit("supervisorReportUpdated", {
        supervisorId: capital.supervisorId,
      });
      req.app.io.emit("transactionUpdated");
      req.app.io.emit("capitalUpdated");
    }

    res.json({
      success: true,
      message: "Additional capital added",
      capital,
    });
  } catch (err) {
    console.error("❌ Error adding additional capital:", err);
    res.status(500).json({ error: "Failed to add additional capital" });
  }
});

/* ======================================================
   💸 REMITTANCE (TELLER)
   ====================================================== */
router.put("/:tellerId/remit", requireAuth, requireRole(['admin', 'super_admin', 'supervisor']), async (req, res) => {
  try {
    const { tellerId } = req.params;
    const { amount, note, userId } = req.body;

    // ✅ Validate amount
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0 || isNaN(parsedAmount)) {
      console.error("❌ Invalid amount for remittance:", amount);
      return res.status(400).json({ error: "Invalid amount. Must be a positive number." });
    }

    const capital = await Capital.findOne({ tellerId, status: "active" });
    if (!capital) {
      return res.status(404).json({ error: "Active capital not found" });
    }

    // ✅ Record remittance transaction AND update Capital model
    console.log(`💸 Recording remittance: ₱${parsedAmount} from teller ${tellerId}`);
    await Transaction.create({
      tellerId,
      supervisorId: capital.supervisorId,
      type: "remittance",
      amount: parsedAmount,
      note: note || "Remittance recorded",
      performedBy: userId,
    });

    // ✅ Update Capital model's totalRemitted
    await Capital.findByIdAndUpdate(
      capital._id,
      { $inc: { totalRemitted: parsedAmount } },
      { new: true }
    );

    if (req.app && req.app.io) {
      req.app.io.emit("tellerManagementUpdated");
      req.app.io.emit("supervisorReportUpdated", {
        supervisorId: capital.supervisorId,
      });
      req.app.io.emit("transactionUpdated");
      req.app.io.emit("capitalUpdated");
    }

    res.json({
      success: true,
      message: "Remittance recorded successfully",
      capital,
    });
  } catch (err) {
    console.error("❌ Error remitting:", err);
    res.status(500).json({ error: "Failed to remit funds" });
  }
});

/* ======================================================
   🧾 GET TELLER DETAILS (CAPITAL + TRANSACTIONS)
   ====================================================== */
router.get("/:tellerId/details", async (req, res) => {
  try {
    const { tellerId } = req.params;

    const activeCapital = await Capital.findOne({
      tellerId,
      status: "active",
    }).lean();

    const transactions = await Transaction.find({ tellerId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ activeCapital, transactions });
  } catch (err) {
    console.error("❌ Error fetching teller details:", err);
    res.status(500).json({ error: "Failed to fetch teller details" });
  }
});

/* ======================================================
   🧩 SUPERVISOR → FETCH ASSIGNED TELLERS
   ====================================================== */
router.get("/tellers", async (req, res) => {
  try {
    const { supervisorId, dateKey, startDate, endDate } = req.query;
    if (!supervisorId) return res.status(400).json({ error: "Missing supervisorId" });

    if (!mongoose.Types.ObjectId.isValid(supervisorId)) {
      return res.status(400).json({ error: "Invalid supervisorId" });
    }

    // Determine date range for querying
    let queryStartOfDay, queryEndOfDay;
    
    if (startDate && endDate) {
      // Use provided date range
      queryStartOfDay = DateTime.fromFormat(startDate, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).startOf('day').toUTC();
      queryEndOfDay = DateTime.fromFormat(endDate, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).plus({ days: 1 }).startOf('day').toUTC();
    } else {
      // Use single dateKey (backward compatibility)
      const now = DateTime.now().setZone("Asia/Manila");
      const targetDate = dateKey || now.toFormat("yyyy-MM-dd");
      queryStartOfDay = DateTime.fromFormat(targetDate, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).startOf('day').toUTC();
      queryEndOfDay = queryStartOfDay.plus({ days: 1 });
    }

    // Fetch all tellers assigned to this supervisor
    const assignedTellers = await User.find({ role: { $in: ["teller", "supervisor_teller"] }, supervisorId }).lean();

    // Also find supervisors who received capital from this supervisor within the date range
    const capitalRecipients = await Transaction.find({
      supervisorId: new mongoose.Types.ObjectId(supervisorId),
      type: { $in: ['capital', 'additional'] },
      createdAt: { $gte: queryStartOfDay.toJSDate(), $lt: queryEndOfDay.toJSDate() }
    }).distinct('tellerId');

    // Get supervisor users who received capital today
    const supervisorRecipients = await User.find({
      _id: { $in: capitalRecipients },
      role: 'supervisor'
    }).lean();

    // Combine assigned tellers with supervisors who received capital, avoiding duplicates
    const userMap = new Map();
    [...assignedTellers, ...supervisorRecipients].forEach(user => {
      userMap.set(user._id.toString(), user);
    });
    const allTellers = Array.from(userMap.values());

    const supervisor = await User.findById(supervisorId)
      .select("name username")
      .lean();
    const supervisorName = supervisor?.name || supervisor?.username || null;

    const data = (await Promise.all(
      allTellers.map(async (t) => {
        try {
          // Fetch transactions for this teller within the date range
          const transactions = await Transaction.find({
            tellerId: t._id,
            createdAt: { $gte: queryStartOfDay.toJSDate(), $lt: queryEndOfDay.toJSDate() }
          }).lean();

          const activeCapital = (await Capital.findOne({ tellerId: t._id, status: "active" }).lean()) || null;

          // Base capital: immutable starting capital from Capital model
          const baseCapital = activeCapital?.amount || 0;

          // Additional capital: from Capital model totalAdditional field (accumulated additions)
          const additionalCapital = activeCapital?.totalAdditional || 0;

          // Remitted: from Capital model totalRemitted field (accumulated remittances)
          const remitted = activeCapital?.totalRemitted || 0;

          // Balance: base + additional - remitted (auto-calculated by Capital model, but we recalc for safety)
          const balance = baseCapital + additionalCapital - remitted;

          // Calculate transactions within the date range (additional and remittance)
          const additionalToday = transactions
            .filter(tx => tx.type === 'additional')
            .reduce((sum, tx) => sum + (tx.amount || 0), 0);

          const remittanceToday = transactions
            .filter(tx => tx.type === 'remittance')
            .reduce((sum, tx) => sum + (tx.amount || 0), 0);

          // Show users if they have transactions in date range OR capital created in date range OR received capital from this supervisor in date range
          const capitalCreatedInRange = !!activeCapital && DateTime.fromJSDate(activeCapital.createdAt).setZone('Asia/Manila') >= DateTime.fromJSDate(queryStartOfDay.toJSDate()).setZone('Asia/Manila') && DateTime.fromJSDate(activeCapital.createdAt).setZone('Asia/Manila') < DateTime.fromJSDate(queryEndOfDay.toJSDate()).setZone('Asia/Manila');
          const hasTransactionsInRange = transactions.length > 0;

          // Check if this user received capital/additional from the requesting supervisor in the date range
          // This is true if the user is in the capitalRecipients list we found earlier
          const receivedCapitalFromSupervisor = capitalRecipients.some(id => id.toString() === t._id.toString());

          if (!hasTransactionsInRange && !capitalCreatedInRange && !receivedCapitalFromSupervisor) {
            return null; // filtered out - no activity in this date range
          }

          // Format date range for response
          const dateRangeLabel = startDate && endDate && startDate !== endDate 
            ? `${startDate} to ${endDate}` 
            : (dateKey || DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd"));

          return {
            _id: t._id,
            name: t.name || t.username,
            username: t.username,
            role: t.role,
            supervisorName,
            activeCapital,
            hasTransactionsInRange,
            capitalCreatedInRange,
            baseCapital,
            additionalCapital,
            remitted,
            balance,
            additionalToday,
            remittanceToday,
            dateRange: dateRangeLabel,
          };
        } catch (innerErr) {
          // Log per-item error but don't fail entire request
          console.error("❌ Error loading teller data for", t._id, innerErr);
          return {
            _id: t._id,
            name: t.name || t.username,
            username: t.username,
            supervisorName,
            activeCapital: null,
            dateKey: targetDate,
          };
        }
      })
    ))
      .filter(Boolean); // remove null (no capital or activity today)

    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching tellers (new route):", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to load tellers" });
  }
});

router.get("/:supervisorId", async (req, res) => {
  try {
    const { supervisorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(supervisorId)) {
      return res.status(400).json({ error: "Invalid supervisorId" });
    }

    const tellers = await User.find({
      role: { $in: ["teller", "supervisor_teller"] },
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
    console.error("❌ Error fetching supervisor tellers:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to load tellers" });
  }
});

/* ======================================================
   🧮 ADMIN VIEW: ALL SUPERVISORS + TELLERS
   ====================================================== */
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

/* ======================================================
   🧹 CLEANUP COMPLETED CAPITALS
   ====================================================== */
router.post("/cleanup", async (req, res) => {
  try {
    const completed = await Capital.updateMany(
      { status: "completed" },
      { $set: { status: "closed" } }
    );

    if (req.app && req.app.io) {
      req.app.io.emit("tellerManagementUpdated");
    }

    res.json({
      success: true,
      message: `${completed.modifiedCount} capital records closed`,
    });
  } catch (err) {
    console.error("❌ Cleanup error:", err);
    res.status(500).json({ error: "Cleanup failed" });
  }
});

/* ======================================================
   🗑️ RESET ALL TRANSACTIONS FOR A TELLER (ADMIN ONLY)
   ====================================================== */
router.delete("/:tellerId/reset-all", async (req, res) => {
  try {
    const { tellerId } = req.params;

    // Delete all capital records for this teller
    const capitalResult = await Capital.deleteMany({ tellerId });
    
    // Delete all transactions for this teller
    const transactionResult = await Transaction.deleteMany({ tellerId });

    console.log(`✅ Reset teller ${tellerId}: ${capitalResult.deletedCount} capital records, ${transactionResult.deletedCount} transactions deleted`);

    // Emit update
    if (req.app && req.app.io) {
      req.app.io.emit("tellerManagementUpdated");
      req.app.io.emit("transactionUpdated");
    }

    res.json({
      success: true,
      message: "All transactions reset successfully",
      capitalDeleted: capitalResult.deletedCount,
      transactionsDeleted: transactionResult.deletedCount
    });
  } catch (err) {
    console.error("❌ Reset error:", err);
    res.status(500).json({ error: "Failed to reset transactions" });
  }
});

/* ======================================================
   🔄 MANUAL AUTO-ASSIGNMENT (ADMIN ONLY)
   ====================================================== */
router.post("/auto-assign", async (req, res) => {
  try {
    const now = DateTime.now().setZone("Asia/Manila");
    const today = now.toFormat("yyyy-MM-dd");
    const yesterday = now.minus({ days: 1 }).toFormat("yyyy-MM-dd");
    
    console.log(`🔄 Manual auto-assignment triggered for ${today}`);
    
    // Find all capital records created yesterday (when supervisors added capital)
    const capitalRecords = await Capital.find({
      createdAt: {
        $gte: new Date(yesterday + 'T00:00:00.000Z'),
        $lt: new Date(today + 'T00:00:00.000Z')
      }
    }).populate('tellerId supervisorId');
    
    console.log(`💰 Found ${capitalRecords.length} capital records from ${yesterday}`);
    
    if (capitalRecords.length === 0) {
      return res.json({
        success: true,
        message: "No capital records found to process assignments",
        assignmentsCreated: 0
      });
    }
    
    // Group capital records by supervisorId
    const supervisorTellerMap = new Map();
    
    for (const capital of capitalRecords) {
      if (capital.supervisorId && capital.tellerId) {
        const supervisorId = capital.supervisorId._id.toString();
        const tellerId = capital.tellerId._id.toString();
        
        if (!supervisorTellerMap.has(supervisorId)) {
          supervisorTellerMap.set(supervisorId, new Set());
        }
        supervisorTellerMap.get(supervisorId).add(tellerId);
      }
    }
    
    console.log(`👨‍💼 Found ${supervisorTellerMap.size} supervisors who added capital`);
    
    // Create daily assignments for today
    const assignments = [];
    let totalAssignments = 0;
    
    for (const [supervisorId, tellerIds] of supervisorTellerMap) {
      const supervisor = await User.findById(supervisorId).select('name username');
      const tellers = await User.find({ 
        _id: { $in: Array.from(tellerIds) },
        role: 'teller',
        status: 'approved'
      }).select('name username');
      
      for (const teller of tellers) {
        // Check if assignment already exists for today
        const existingAssignment = await DailyTellerAssignment.findOne({
          dayKey: today,
          tellerId: teller._id,
          supervisorId: supervisorId
        });
        
        if (!existingAssignment) {
          assignments.push({
            dayKey: today,
            tellerId: teller._id,
            supervisorId: supervisorId,
            status: 'scheduled',
            assignedBy: req.user?.username || 'manual-admin',
            assignedAt: new Date(),
            completed: false
          });
          totalAssignments++;
        }
      }
    }
    
    // Bulk insert new assignments
    if (assignments.length > 0) {
      await DailyTellerAssignment.insertMany(assignments);
      console.log(`✅ Manual auto-assigned ${totalAssignments} teller-supervisor relationships`);
    }
    
    // Emit update
    if (req.app && req.app.io) {
      req.app.io.emit("tellerManagementUpdated");
    }
    
    res.json({
      success: true,
      message: `Auto-assigned ${totalAssignments} tellers to supervisors`,
      assignmentsCreated: totalAssignments,
      supervisorsCount: supervisorTellerMap.size,
      date: today
    });
    
  } catch (err) {
    console.error("❌ Manual auto-assignment error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to perform auto-assignment",
      message: err.message
    });
  }
});

/* ======================================================
   ✏️ ADMIN → UPDATE TELLER MANAGEMENT VALUES
   ====================================================== */
router.put("/:tellerId/update-values", async (req, res) => {
  try {
    const { tellerId } = req.params;
    const { baseCapital, additionalCapital, totalRemitted } = req.body;

    if (!tellerId) {
      return res.status(400).json({ error: "Missing tellerId" });
    }

    // Find active capital record for this teller
    const activeCapital = await Capital.findOne({ tellerId, status: "active" });

    if (activeCapital) {
      // Update the capital record
      if (baseCapital !== undefined) {
        activeCapital.amount = Number(baseCapital);
      }
      if (totalRemitted !== undefined) {
        activeCapital.totalRemitted = Number(totalRemitted);
      }
      
      // Recalculate balance
      const additional = Number(additionalCapital || 0);
      const base = Number(baseCapital !== undefined ? baseCapital : activeCapital.amount);
      const remitted = Number(totalRemitted !== undefined ? totalRemitted : activeCapital.totalRemitted);
      
      activeCapital.balanceRemaining = base + additional - remitted;
      
      await activeCapital.save();
    }

    // You might also want to update transactions to reflect these changes
    // For now, we're updating the capital record which is the source of truth

    // Emit socket event
    if (req.app && req.app.io) {
      req.app.io.emit("tellerManagementUpdated");
    }

    console.log(`✅ Admin updated teller ${tellerId} values`);
    
    res.json({ 
      success: true, 
      message: "Teller data updated successfully",
      data: activeCapital
    });
  } catch (err) {
    console.error("❌ Error updating teller values:", err);
    res.status(500).json({ error: "Failed to update teller data" });
  }
});

/* ======================================================
   🔍 CHECK IF USER HAS CAPITAL TODAY
   ====================================================== */
router.get("/capital/check-today/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if user has capital today
    const capital = await Capital.findOne({
      $or: [
        { tellerId: userId },
        { supervisorId: userId }
      ],
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    res.json({ 
      success: true, 
      hasCapital: !!capital,
      capital: capital || null
    });
  } catch (err) {
    console.error("❌ Error checking capital:", err);
    res.status(500).json({ error: "Failed to check capital" });
  }
});

/* ======================================================
   🗑️ DELETE CAPITAL FOR A TELLER (SUPERVISOR/ADMIN)
   ====================================================== */
router.delete("/:tellerId/capital/:capitalId", async (req, res) => {
  try {
    const { tellerId, capitalId } = req.params;

    // Find and delete the capital record
    const capitalToDelete = await Capital.findOneAndDelete({
      _id: capitalId,
      tellerId: tellerId
    });

    if (!capitalToDelete) {
      return res.status(404).json({ error: "Capital record not found" });
    }

    // Reset base salary to 0 for this teller
    const teller = await User.findById(tellerId);
    if (teller) {
      teller.baseCapital = 0;
      await teller.save();
      console.log(`✅ Reset base salary to 0 for teller ${tellerId}`);
    }

    // Delete all transactions related to this capital record
    const transactionResult = await Transaction.deleteMany({
      tellerId: tellerId,
      type: { $in: ["capital", "additional", "remittance"] },
      capitalId: capitalId
    });

    console.log(`✅ Deleted capital ${capitalId} for teller ${tellerId}, removed ${transactionResult.deletedCount} transactions`);

    // Emit socket events
    if (req.app && req.app.io) {
      req.app.io.emit("tellerManagementUpdated");
      req.app.io.emit("transactionUpdated");
      req.app.io.emit("capitalDeleted", { tellerId, capitalId });
    }

    res.json({
      success: true,
      message: "Capital deleted successfully and base salary reset",
      capitalDeleted: capitalToDelete,
      transactionsDeleted: transactionResult.deletedCount
    });
  } catch (err) {
    console.error("❌ Error deleting capital:", err);
    res.status(500).json({ error: "Failed to delete capital" });
  }
});

export default router;
