import express from "express";
import TellerReport from "../models/TellerReport.js";
import User from "../models/User.js";
import Capital from "../models/Capital.js";
import Payroll from "../models/Payroll.js";
import AuditLog from "../models/AuditLog.js";
import SystemSettings from "../models/SystemSettings.js";

const router = express.Router();

/* ======================================================
   DIAGNOSTIC ENDPOINT - Check teller submission ability
   ====================================================== */
router.get("/diagnostic/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 Running diagnostic for user: ${userId}`);
    
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ 
        error: "User not found",
        success: false 
      });
    }
    
    const diagnostic = {
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        status: user.status,
        supervisorId: user.supervisorId,
      },
      canSubmit: true,
      issues: [],
      requirements: {
        isApprovedUser: user.status === 'approved',
        isTellerRole: user.role === 'teller',
        hasSupervisor: !!user.supervisorId,
        hasActiveCapital: false,
      }
    };
    
    // Check for blocking issues
    if (user.status !== 'approved') {
      diagnostic.canSubmit = false;
      diagnostic.issues.push(`User status is '${user.status}', must be 'approved'`);
    }
    
    if (user.role !== 'teller') {
      diagnostic.canSubmit = false;
      diagnostic.issues.push(`User role is '${user.role}', must be 'teller'`);
    }
    
    if (!user.supervisorId) {
      diagnostic.issues.push('No supervisor assigned - reports may not route properly');
    } else {
      const supervisor = await User.findById(user.supervisorId).lean();
      diagnostic.supervisor = supervisor ? {
        id: supervisor._id,
        name: supervisor.name,
        username: supervisor.username,
        role: supervisor.role,
        status: supervisor.status
      } : null;
      
      if (!supervisor) {
        diagnostic.issues.push('Assigned supervisor not found in database');
      }
    }
    
    // Check for active capital
    const activeCapital = await Capital.findOne({ tellerId: userId, status: 'active' }).lean();
    diagnostic.requirements.hasActiveCapital = !!activeCapital;
    if (activeCapital) {
      diagnostic.capital = {
        id: activeCapital._id,
        amount: activeCapital.amount,
        totalAdditional: activeCapital.totalAdditional || 0,
        totalRemitted: activeCapital.totalRemitted || 0,
        balanceRemaining: activeCapital.balanceRemaining || 0,
        createdAt: activeCapital.createdAt
      };
    }
    
    if (!activeCapital) {
      diagnostic.canSubmit = false;
      diagnostic.issues.push('No active capital assigned - cannot submit reports');
    }
    
    console.log(`✅ Diagnostic complete for ${user.username}:`, diagnostic);
    res.json(diagnostic);
    
  } catch (error) {
    console.error("❌ Diagnostic error:", error);
    res.status(500).json({ 
      error: "Diagnostic failed", 
      message: error.message,
      success: false 
    });
  }
});

/* ======================================================
   CREATE TELLER REPORT
   ====================================================== */
router.post("/create", async (req, res) => {
  try {
    let {
      tellerId,
      tellerName,
      supervisorId,
      supervisorName,
      systemBalance,
      cashOnHand,
      short,
      over,
      d1000,
      d500,
      d200,
      d100,
      d50,
      d20,
      coins,
    } = req.body;

    if (!tellerId) return res.status(400).json({ error: "Missing teller ID" });

    // 🔍 Check if teller has active capital for today
    const activeCapital = await Capital.findOne({
      tellerId,
      status: "active",
    });

    if (!activeCapital) {
      return res.status(403).json({
        error: "You cannot submit a teller report without active capital. Please contact your supervisor to receive capital before submitting your report."
      });
    }

    // 🔍 Check if teller already submitted a report today (only if multiple reports not allowed)
    const systemSettings = await SystemSettings.findOne().lean();
    const allowMultipleReports = systemSettings?.allowMultipleReportsPerDay || false;
    
    if (!allowMultipleReports) {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const existingReport = await TellerReport.findOne({
        tellerId,
        createdAt: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      });
      
      if (existingReport) {
        return res.status(400).json({ 
          error: "You have already submitted a report today. Only one report per day is allowed." 
        });
      }
    }

    // 🔍 Debug logging - what we received
    console.log("📥 Received teller report data:");
    console.log("   System Balance:", systemBalance);
    console.log("   Cash On Hand:", cashOnHand);
    console.log("   Short:", short);
    console.log("   Over:", over);
    console.log("   Denominations:", { d1000, d500, d200, d100, d50, d20, coins });

    // ✅ Auto-attach supervisor if missing
    if (!supervisorId) {
      const tellerUser = await User.findById(tellerId).lean();
      if (tellerUser?.supervisorId) {
        supervisorId = tellerUser.supervisorId.toString();
        const sup = await User.findById(supervisorId).lean();
        supervisorName = sup?.name || sup?.username || "";
      }
    }

    // ✅ Create new report
    const newReport = {
      tellerId,
      tellerName,
      supervisorId,
      supervisorName,
      systemBalance: Number(systemBalance || 0),
      cashOnHand: Number(cashOnHand || 0),
      short: Number(short || 0),
      over: Number(over || 0),
      d1000: Number(d1000 || 0),
      d500: Number(d500 || 0),
      d200: Number(d200 || 0),
      d100: Number(d100 || 0),
      d50: Number(d50 || 0),
      d20: Number(d20 || 0),
      coins: Number(coins || 0),
      createdAt: new Date(),
    };

    const created = await TellerReport.create(newReport);

    // 🔍 Debug logging - what was saved
    console.log("💾 Saved teller report:");
    console.log("   ID:", created._id);
    console.log("   System Balance:", created.systemBalance);
    console.log("   Cash On Hand:", created.cashOnHand);
    console.log("   Short:", created.short);
    console.log("   Over:", created.over);
    console.log("   Denominations:", {
      d1000: created.d1000,
      d500: created.d500,
      d200: created.d200,
      d100: created.d100,
      d50: created.d50,
      d20: created.d20,
      coins: created.coins
    });

    // ✅ Update capital after report submission
    const capitalToComplete = await Capital.findOne({
      tellerId,
      status: "active",
    });
    if (capitalToComplete) {
      capitalToComplete.status = "completed";
      await capitalToComplete.save();
    }

    // ✅ Emit live updates
    if (req.app && req.app.io) {
      req.app.io.emit("tellerReportCreated", created);
      if (supervisorId)
        req.app.io.emit("supervisorReportUpdated", { supervisorId });
    }

    // ✅ Auto-sync payroll with teller reports
    await syncPayrollFromReports(tellerId);

    res.json({
      success: true,
      message: "Teller report submitted successfully",
      report: created,
    });
  } catch (err) {
    console.error("❌ Error creating teller report:", err);
    res.status(500).json({ error: "Failed to submit report" });
  }
});

/* ======================================================
   FETCH REPORTS PER TELLER
   ====================================================== */
router.get("/teller/:tellerId", async (req, res) => {
  try {
    const { tellerId } = req.params;
    const { fromDate, toDate } = req.query;
    
    // Build date filter query
    let dateFilter = {};
    if (fromDate && toDate) {
      dateFilter.createdAt = {
        $gte: new Date(fromDate + 'T00:00:00.000Z'),
        $lte: new Date(toDate + 'T23:59:59.999Z')
      };
    } else if (fromDate) {
      dateFilter.createdAt = { $gte: new Date(fromDate + 'T00:00:00.000Z') };
    } else if (toDate) {
      dateFilter.createdAt = { $lte: new Date(toDate + 'T23:59:59.999Z') };
    }
    
    const query = {
      tellerId,
      ...dateFilter
    };
    
    const reports = await TellerReport.find(query).sort({
      createdAt: -1,
    });
    res.json({ reports });
  } catch (err) {
    console.error("❌ Error fetching teller reports:", err);
    res.status(500).json({ error: "Failed to fetch teller reports" });
  }
});

/* ======================================================
   PER-REPORT STATUS ACTIONS (ADMIN) BY REPORT ID
   ====================================================== */
router.put("/report/:reportId/approve", async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await TellerReport.findById(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });
    report.isApproved = true;
    report.isPending = false;
    await report.save();
    await syncPayrollFromReports(report.tellerId);
    if (global.io) global.io.emit("reportUpdated", { reportId });
    res.json({ success: true, message: "Report approved", reportId });
  } catch (err) {
    console.error("❌ Error approving report:", err);
    res.status(500).json({ error: "Failed to approve report" });
  }
});

router.put("/report/:reportId/verify", async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await TellerReport.findById(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });
    report.isVerified = true;
    report.isPending = false;
    await report.save();
    if (global.io) global.io.emit("reportUpdated", { reportId });
    res.json({ success: true, message: "Report verified", reportId });
  } catch (err) {
    console.error("❌ Error verifying report:", err);
    res.status(500).json({ error: "Failed to verify report" });
  }
});

router.put("/report/:reportId/unlock", async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await TellerReport.findById(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });
    report.isApproved = false; // simple unlock semantics
    report.isVerified = false;
    report.isPending = true;
    await report.save();
    if (global.io) global.io.emit("reportUpdated", { reportId });
    res.json({ success: true, message: "Report unlocked", reportId });
  } catch (err) {
    console.error("❌ Error unlocking report:", err);
    res.status(500).json({ error: "Failed to unlock report" });
  }
});

/* ======================================================
   FETCH SINGLE REPORT BY ID (USED BY FRONTEND VIEWER)
   ====================================================== */
router.get("/report/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    if (!reportId) return res.status(400).json({ error: "Missing reportId" });
    const report = await TellerReport.findById(reportId).populate("tellerId", "name username");
    if (!report) return res.status(404).json({ error: "Report not found" });
    // Normalize tellerName for frontend consistency
    const r = report.toObject();
    if (!r.tellerName && r.tellerId) {
      r.tellerName = r.tellerId.name || r.tellerId.username || "Unknown";
    }
    res.json(r);
  } catch (err) {
    console.error("❌ Error fetching single report:", err);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

/* ======================================================
   FETCH REPORTS BY SUPERVISOR (AGGREGATED)
   ====================================================== */
router.get("/supervisor/:supervisorId", async (req, res) => {
  try {
    const { supervisorId } = req.params;
    const { date, fromDate, toDate } = req.query;
    
    // Build date filter query (support both single date and date range)
    let dateFilter = {};
    if (date) {
      // Single date filter - match reports created on this specific date
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');
      dateFilter.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    } else if (fromDate && toDate) {
      dateFilter.createdAt = {
        $gte: new Date(fromDate + 'T00:00:00.000Z'),
        $lte: new Date(toDate + 'T23:59:59.999Z')
      };
    } else if (fromDate) {
      dateFilter.createdAt = { $gte: new Date(fromDate + 'T00:00:00.000Z') };
    } else if (toDate) {
      dateFilter.createdAt = { $lte: new Date(toDate + 'T23:59:59.999Z') };
    }

    // Get active/approved tellers only under this supervisor
    const activeTellers = await User.find({
      role: { $in: ['teller', 'supervisor_teller'] },
      status: 'approved',
      supervisorId: supervisorId
    }).select('_id');
    
    const activeTellerIds = activeTellers.map(t => t._id);

    // Show ALL reports from active tellers (including verified/approved ones)
    const query = {
      supervisorId,
      tellerId: { $in: activeTellerIds }, // Only active tellers
      ...dateFilter
    };
    
    const reports = await TellerReport.find(query)
      .populate("tellerId", "name username") // ✅ Populate teller info
      .sort({ createdAt: -1 });

    // ✅ Aggregate totals
    const totals = {
      totalSystemBalance: 0,
      totalCashOnHand: 0,
      totalShort: 0,
      totalOver: 0,
      denominationTotals: {
        d1000: 0,
        d500: 0,
        d200: 0,
        d100: 0,
        d50: 0,
        d20: 0,
        coins: 0,
      },
    };

    reports.forEach((r) => {
      totals.totalSystemBalance += r.systemBalance || 0;
      totals.totalCashOnHand += r.cashOnHand || 0;
      totals.totalShort += r.short || 0;
      totals.totalOver += r.over || 0;
      totals.denominationTotals.d1000 += r.d1000 || 0;
      totals.denominationTotals.d500 += r.d500 || 0;
      totals.denominationTotals.d200 += r.d200 || 0;
      totals.denominationTotals.d100 += r.d100 || 0;
      totals.denominationTotals.d50 += r.d50 || 0;
      totals.denominationTotals.d20 += r.d20 || 0;
      totals.denominationTotals.coins += r.coins || 0;
    });

    const supervisor = await User.findById(supervisorId)
      .select("name username")
      .lean();

    // ✅ Transform reports to ensure tellerName is always present
    const transformedReports = reports.map(r => {
      const report = r.toObject ? r.toObject() : r;
      // Use existing tellerName or fallback to populated tellerId
      if (!report.tellerName && report.tellerId) {
        report.tellerName = report.tellerId.name || report.tellerId.username || "Unknown";
      }
      return report;
    });

    res.json({
      supervisorId,
      supervisorName: supervisor?.name || supervisor?.username || "",
      tellers: transformedReports,
      totalSystemBalance: totals.totalSystemBalance,
      totalCashOnHand: totals.totalCashOnHand,
      totalShort: totals.totalShort,
      totalOver: totals.totalOver,
      denominationTotals: totals.denominationTotals,
    });
  } catch (err) {
    console.error("❌ Error fetching supervisor report:", err);
    res.status(500).json({ error: "Failed to fetch supervisor report" });
  }
});

/* ======================================================
   FETCH ALL REPORTS (ADMIN VIEW)
   ====================================================== */
router.get("/all", async (req, res) => {
  try {
    // Extract date filter parameters (support both single date and date range)
    const { date, fromDate, toDate } = req.query;
    
    // Build date filter query
    let dateFilter = {};
    if (date) {
      // Single date filter - match reports created on this specific date
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');
      dateFilter.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    } else if (fromDate && toDate) {
      dateFilter.createdAt = {
        $gte: new Date(fromDate + 'T00:00:00.000Z'),
        $lte: new Date(toDate + 'T23:59:59.999Z')
      };
    } else if (fromDate) {
      dateFilter.createdAt = { $gte: new Date(fromDate + 'T00:00:00.000Z') };
    } else if (toDate) {
      dateFilter.createdAt = { $lte: new Date(toDate + 'T23:59:59.999Z') };
    }
    
    // Get active/approved tellers only
    const activeTellers = await User.find({
      role: { $in: ['teller', 'supervisor_teller'] },
      status: 'approved'
    }).select('_id');
    
    const activeTellerIds = activeTellers.map(t => t._id);
    
    // Show ALL reports from active tellers (including verified ones)
    const query = {
      tellerId: { $in: activeTellerIds }, // Only active tellers
      ...dateFilter
    };
    
    const reports = await TellerReport.find(query).sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    console.error("❌ Error fetching all reports:", err);
    res.status(500).json({ error: "Failed to fetch all reports" });
  }
});

/* ======================================================
   OVERRIDE TELLER REPORT (ADMIN ONLY)
   ====================================================== */
router.put("/:tellerId/override", async (req, res) => {
  try {
    const { tellerId } = req.params;
    const { date, supervisorId, supervisorName, systemBalance, cashOnHand, short, over } = req.body;

    if (!tellerId || !date) {
      return res.status(400).json({ error: "Missing teller ID or date" });
    }

    // Find or create report for this teller on this date
    let report = await TellerReport.findOne({
      tellerId: tellerId,
      date: date
    });

    const teller = await User.findById(tellerId);
    if (!teller) {
      return res.status(404).json({ error: "Teller not found" });
    }

    if (report) {
      // Update existing report
      report.tellerName = teller.name || teller.username; // ✅ Update teller name
      report.supervisorId = supervisorId || report.supervisorId;
      report.supervisorName = supervisorName || report.supervisorName;
      report.systemBalance = systemBalance;
      report.cashOnHand = cashOnHand;
      report.short = short;
      report.over = over;
      report.isOverridden = true;
      await report.save();
    } else {
      // Create new report
      report = await TellerReport.create({
        tellerId: tellerId,
        tellerName: teller.name || teller.username,
        supervisorId: supervisorId || teller.supervisorId,
        supervisorName: supervisorName,
        date: date,
        systemBalance: systemBalance,
        cashOnHand: cashOnHand,
        short: short,
        over: over,
        isOverridden: true
      });
    }

    // Update teller's supervisor assignment if provided
    if (supervisorId && teller.supervisorId?.toString() !== supervisorId) {
      teller.supervisorId = supervisorId;
      await teller.save();
      console.log(`✅ Updated ${teller.name || teller.username}'s supervisor assignment`);
    }

    console.log(`✅ Report overridden for ${teller.name || teller.username} on ${date}`);

    // ✅ Auto-sync payroll with updated report
    await syncPayrollFromReports(tellerId);

    if (global.io) {
      global.io.emit("reportUpdated");
    }

    res.json({
      success: true,
      message: "Report overridden successfully",
      report
    });
  } catch (err) {
    console.error("❌ Error overriding report:", err);
    res.status(500).json({ error: "Failed to override report" });
  }
});

/* ======================================================
   DELETE SPECIFIC REPORT (ADMIN ONLY)
   ====================================================== */
router.delete("/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    const { adminId, reason } = req.body || {};

    const report = await TellerReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    const tellerId = report.tellerId;
    await report.deleteOne();

    // Audit log (best-effort)
    try {
      const adminUser = adminId ? await User.findById(adminId).lean() : null;
      await AuditLog.create({
        actorId: adminId || null,
        actorName: adminUser?.name || adminUser?.username || "admin",
        actionType: "DELETE_TELLER_REPORT",
        data: { reportId, tellerId, reason: reason || "No reason provided" },
      });
    } catch (e) {
      console.warn("⚠️ Failed to write audit log for report deletion:", e.message);
    }

    // Re-sync payroll after deletion
    await syncPayrollFromReports(tellerId);

    if (global.io) {
      global.io.emit("reportDeleted", { reportId, tellerId });
    }

    res.json({ success: true, message: "Report deleted successfully", reportId });
  } catch (err) {
    console.error("❌ Error deleting report:", err);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

/* ======================================================
   HELPER: Sync Payroll from Teller Reports
   ====================================================== */
async function syncPayrollFromReports(tellerId) {
  try {
    // Get current week date range (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Monday of current week
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    
    // Calculate Sunday of current week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Find all reports for this teller in current week
    const reports = await TellerReport.find({
      tellerId: tellerId,
      createdAt: { $gte: monday, $lte: sunday }
    }).lean();

    // Calculate totals for current week
    const totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
    
    // For short amounts with payment terms, calculate weekly installment
    // Payment terms represent number of WEEKS to spread the payment
    const totalShort = reports.reduce((sum, r) => {
      const shortAmount = Number(r.short) || 0;
      const paymentTerms = Number(r.shortPaymentTerms) || 1;
      // Deduct 1/terms of the short amount per week
      return sum + (shortAmount / paymentTerms);
    }, 0);

    // Find ALL payrolls for this user for this week (might be multiple from old daily system)
    const existingPayrolls = await Payroll.find({
      user: tellerId,
      createdAt: { $gte: monday, $lte: sunday }
    }).sort({ createdAt: 1 }); // Sort by oldest first

    // Always read current user to keep baseSalary in sync
    const user = await User.findById(tellerId);
    if (!user) {
      console.warn("⚠️ User not found for payroll sync:", tellerId);
      return;
    }

    if (existingPayrolls.length === 0) {
      // Create new payroll entry ONLY if none exist
      const payroll = new Payroll({
        user: tellerId,
        role: user.role,
        baseSalary: user.baseSalary || 0,
        over: totalOver,
        short: totalShort,
        deduction: 0,
        withdrawal: 0,
        createdAt: monday, // Set to Monday of the week
      });
      await payroll.save();
      console.log(`✅ Creating new payroll for ${tellerId} for week ${monday.toISOString()}`);
    } else {
      // Update ALL existing payrolls in the week with current week's totals
      for (const payroll of existingPayrolls) {
        console.log(`✅ Updating existing payroll ${payroll._id} for ${tellerId}`);
        
        // Update with current week's totals
        payroll.over = totalOver;
        payroll.short = totalShort;
        // If base salary changed or missing, sync from user record
        if ((payroll.baseSalary || 0) !== (user.baseSalary || 0)) {
          payroll.baseSalary = user.baseSalary || 0;
        }
        if (!payroll.role && user.role) payroll.role = user.role;
      }

      // Calculate total salary for each payroll: baseSalary + over - weeklyShortDeduction - deduction - withdrawal
      for (const payroll of existingPayrolls) {
        const overAmt = payroll.over || totalOver || 0;
        const shortAmt = payroll.short || totalShort || 0; // payroll.short may already be expressed as weekly installment
        payroll.totalSalary = (payroll.baseSalary || 0) +
                              Number(overAmt || 0) -
                              Number(shortAmt || 0) -
                              (payroll.deduction || 0) -
                              (payroll.withdrawal || 0);
      }

      // Add note about weekly payment terms if applicable
      const hasPaymentTerms = reports.some(r => (Number(r.shortPaymentTerms) || 1) > 1);
      if (hasPaymentTerms) {
        const termsInfo = reports
          .filter(r => (Number(r.shortPaymentTerms) || 1) > 1)
          .map(r => `₱${r.short} short over ${r.shortPaymentTerms} weeks`)
          .join(', ');
        for (const payroll of existingPayrolls) {
          payroll.note = `Weekly installment payment. ${termsInfo}`;
        }
      }
      
      // Save all updated payrolls
      await Promise.all(existingPayrolls.map(p => p.save()));
    }

    console.log(`✅ Payroll synced for teller ${tellerId}: over=${totalOver}, short=${totalShort} (weekly with terms)`);

    // Emit real-time update for all updated payrolls
    if (global.io) {
      if (existingPayrolls.length > 0) {
        existingPayrolls.forEach(payroll => {
          global.io.emit("payrollUpdated", { userId: tellerId, payrollId: payroll._id });
        });
      } else {
        global.io.emit("payrollUpdated", { userId: tellerId, payrollId: payroll._id });
      }
    }

  } catch (err) {
    console.error("❌ Error syncing payroll from reports:", err);
  }
}

export default router;
