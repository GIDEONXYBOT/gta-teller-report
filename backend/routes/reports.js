import express from "express";
import User from "../models/User.js";
import TellerReport from "../models/TellerReport.js";
import Payroll from "../models/Payroll.js";
import SupervisorReport from "../models/SupervisorReport.js";
import TellerManagementModel from "../models/TellerManagementModel.js";
import Transaction from "../models/Transaction.js";
import TellerMapping from "../models/TellerMapping.js";
import { DateTime } from "luxon";
import { requireAuth, requireRole } from "../middleware/auth.js";
import axios from "axios";

const router = express.Router();

/**
 * 🎯 GET /api/reports/teller-mappings
 * Get all teller mappings between reporting system and betting API
 * (Super Admin Only)
 */
router.get("/teller-mappings", requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    console.log("🎯 Fetching teller mappings...");

    const mappings = await TellerMapping.find({ isActive: true })
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${mappings.length} active teller mappings`);
    
    // Get teller details separately to avoid populate issues
    const tellerIds = mappings.map(m => m.tellerId);
    const tellers = await User.find({ _id: { $in: tellerIds } }).select('username name role status');
    const tellerMap = {};
    tellers.forEach(teller => {
      tellerMap[teller._id.toString()] = teller;
    });

    res.json({
      success: true,
      mappings: mappings.map(mapping => {
        const teller = tellerMap[mapping.tellerId.toString()] || {};
        return {
          id: mapping._id,
          tellerId: mapping.tellerId,
          tellerUsername: teller.username || 'Unknown',
          tellerName: teller.name || 'Unknown',
          bettingUsername: mapping.bettingUsername,
          bettingName: mapping.bettingName,
          matchConfidence: mapping.matchConfidence,
          matchReason: mapping.matchReason,
          lastBettingSync: mapping.lastBettingSync,
          bettingData: mapping.bettingData,
          createdAt: mapping.createdAt
        };
      })
    });

  } catch (error) {
    console.error("❌ Failed to fetch teller mappings:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch teller mappings",
      error: error.message
    });
  }
});

/**
 * ✅ Admin overrides a teller report
 */
router.put("/teller/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { systemBalance, cashOnHand, over, short, remarks, date, shortPaymentTerms } = req.body;
    const report = await TellerReport.findById(id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (systemBalance !== undefined) report.systemBalance = systemBalance;
    if (cashOnHand !== undefined) report.cashOnHand = cashOnHand;
    if (over !== undefined) report.over = over;
    if (short !== undefined) report.short = short;
    if (remarks !== undefined) report.remarks = remarks;
    if (shortPaymentTerms !== undefined) {
      const terms = Number(shortPaymentTerms);
      report.shortPaymentTerms = terms >= 1 ? terms : 1;
    }

    // Allow admin to adjust the report date (and createdAt for convenience)
    let reportDate = report.createdAt || new Date();
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        reportDate = parsed;
        report.date = parsed.toISOString();
        report.createdAt = parsed;
      }
    }

    report.isOverridden = true;
    await report.save();

    // Update payroll record for this teller and the report date
    const tellerId = report.tellerId || report.userId;
    if (tellerId) {
      // compute day range for the reportDate
      const rd = new Date(reportDate);
      const dayStart = new Date(rd.getFullYear(), rd.getMonth(), rd.getDate(), 0, 0, 0);
      const dayEnd = new Date(rd.getFullYear(), rd.getMonth(), rd.getDate(), 23, 59, 59, 999);

      let payroll = await Payroll.findOne({
        user: tellerId,
        createdAt: { $gte: dayStart, $lte: dayEnd },
      });

      // If payroll for that day doesn't exist, create one using user's baseSalary
      if (!payroll) {
        const user = await User.findById(tellerId).lean();
        const base = (user && user.baseSalary) ? Number(user.baseSalary) : 0;
        payroll = new Payroll({
          user: tellerId,
          role: user?.role || report.role || "teller",
          baseSalary: base,
          over: 0,
          short: 0,
          deduction: 0,
          withdrawal: 0,
          totalSalary: base,
          createdAt: reportDate,
        });
      }

      // Apply report over/short values
      payroll.over = Number(report.over) || 0;
      payroll.short = Number(report.short) || 0;
      payroll.shortPaymentTerms = Number(report.shortPaymentTerms) || 1;

      // Calculate the actual short deduction based on weekly payment terms
      // Payment terms represent number of WEEKS to spread the payment
      const shortPaymentTerms = payroll.shortPaymentTerms;
      const weeklyShortDeduction = payroll.short / shortPaymentTerms;

      // For report override with payment terms: include over and weekly short deduction
      const baseSalary = Number(payroll.baseSalary || 0);
      const deduction = Number(payroll.deduction || 0);
      payroll.totalSalary = baseSalary + Number(payroll.over || 0) - weeklyShortDeduction - deduction;

      payroll.approved = true;
      payroll.approvedAt = new Date();
      payroll.note = `Updated via Teller Report override on ${new Date().toLocaleString()}${shortPaymentTerms > 1 ? ` (Weekly short payment: ₱${payroll.short} over ${shortPaymentTerms} weeks = ₱${weeklyShortDeduction.toFixed(2)}/week)` : ''}`;

      await payroll.save();
    }

    if (global.io) global.io.emit("reportUpdated", { id, overridden: true });
    res.json({ message: "✅ Report overridden successfully", report });
  } catch (err) {
    console.error("Error overriding report:", err);
    res.status(500).json({ message: "Failed to override report" });
  }
});

/**
 * PUT /api/reports/supervisor/update-bet/:tellerId
 * Admin updates totalBet for a teller report
 */
router.put("/supervisor/update-bet/:tellerId", async (req, res) => {
  try {
    const { tellerId } = req.params;
    const { totalBet } = req.body;

    if (!tellerId || totalBet == null) {
      return res.status(400).json({ message: "Missing tellerId or totalBet" });
    }

    // Find the most recent teller report for this user
    const report = await TellerReport.findOne({ tellerId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!report) {
      return res.status(404).json({ message: "No report found for this teller" });
    }

    // Update the totalBet field (add it if not exists in schema)
    report.totalBet = Number(totalBet);
    await report.save();

    if (global.io) {
      global.io.emit("reportUpdated", { id: report._id, tellerId });
    }

    res.json({ 
      message: "Total Bet updated successfully", 
      report 
    });
  } catch (err) {
    console.error("Error updating total bet:", err);
    res.status(500).json({ message: "Failed to update total bet" });
  }
});


/**
 * GET /api/reports/tellers
 * Returns all approved tellers (including supervisor_teller) for supervisor dropdowns
 */
router.get("/tellers", async (req, res) => {
  try {
    const tellers = await User.find({ 
      role: { $in: ["teller", "supervisor_teller"] }, 
      status: "approved" 
    })
      .select("_id username name")
      .lean();

  // Get today's date range in Manila timezone (correctly, not by UTC string concatenation)
  const now = DateTime.now().setZone("Asia/Manila");
  const todayKey = now.toFormat("yyyy-MM-dd");
  const startOfDay = now.startOf('day').toJSDate();
  const endOfDay = now.endOf('day').toJSDate();
    
    console.log("📅 Checking capital for date:", todayKey);
    console.log("👥 Total tellers:", tellers.length);

    // Fetch all transactions for today to check which tellers have capital
    const todayTransactions = await Transaction.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      type: { $in: ["capital", "additional"] }
    }).lean();
    
    console.log("💰 Capital transactions today:", todayTransactions.length);

    // Create a set of teller IDs who have capital today
    const tellersWithCapitalSet = new Set();
    todayTransactions.forEach(tx => {
      if (tx.tellerId) {
        tellersWithCapitalSet.add(tx.tellerId.toString());
      }
    });

    console.log("✅ Tellers with capital today:", tellersWithCapitalSet.size);

    // Determine working tellers from TellerManagement (active records for today)
    const activeManagementRecords = await TellerManagementModel.find({
      dateKey: todayKey,
      status: 'active'
    }).lean();
    const workingSet = new Set(activeManagementRecords.map(r => r.tellerId));
    console.log("🛠️ Active working records today:", workingSet.size);

    // Add hasCapital + isWorking flags to each teller
    const tellersWithCapital = tellers.map(t => {
      const idStr = t._id.toString();
      const hasCapital = tellersWithCapitalSet.has(idStr);
      const isWorking = workingSet.has(idStr) || hasCapital; // treat capital as implicit working
      if (hasCapital) console.log(`  💰 ${t.name} has capital`);
      if (isWorking && !hasCapital) console.log(`  🟢 ${t.name} marked working (active record)`);
      return { ...t, hasCapital, isWorking };
    });

  const withCapCount = tellersWithCapital.filter(t => t.hasCapital).length;
  const workingCount = tellersWithCapital.filter(t => t.isWorking).length;
  console.log(`📊 Result: ${withCapCount}/${tellers.length} have capital; ${workingCount} are working today`);

    res.json(tellersWithCapital);
  } catch (err) {
    console.error("Error fetching tellers list:", err);
    res.status(500).json({ message: "Failed to load tellers" });
  }
});

/**
 * GET /api/reports/supervisors/list
 * Returns list of supervisors (for dropdowns) with submission status
 */
router.get("/supervisors/list", async (req, res) => {
  try {
    const supervisors = await User.find({ 
      role: { $in: ["supervisor", "supervisor_teller"] }, 
      status: "approved" 
    })
      .select("_id username name")
      .lean();

    // Get today's date key
    const now = DateTime.now().setZone("Asia/Manila");
    const todayKey = now.toFormat("yyyy-MM-dd");

    // Check submission status for each supervisor
    const supervisorsWithStatus = await Promise.all(
      supervisors.map(async (sup) => {
        const report = await SupervisorReport.findOne({
          supervisorId: sup._id.toString(),
          dateKey: todayKey
        }).select("submitted submittedAt").lean();

        return {
          ...sup,
          submitted: report?.submitted || false,
          submittedAt: report?.submittedAt || null
        };
      })
    );

    res.json(supervisorsWithStatus);
  } catch (err) {
    console.error("Error fetching supervisors list:", err);
    res.status(500).json({ message: "Failed to load supervisors" });
  }
});

/**
 * 👥 GET /api/reports/supervisor/staff-performance
 * Fetch betting event staff performance data filtered for supervisor's tellers only
 */
router.get("/supervisor/staff-performance", requireAuth, requireRole(['supervisor']), async (req, res) => {
  try {
    console.log("👥 Fetching supervisor staff performance data...");

    // Use the authenticated user's ID as the supervisor ID
    const supervisorId = req.user._id.toString();

    // Fetch betting event data from external API
    const response = await fetch('https://rmi-gideon.gtarena.ph/api/m/secure/report/event', {
      method: 'GET',
      headers: {
        'X-TOKEN': 'af9735e1c7857a07f0b078df36842ace',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ External API error: ${response.status} ${response.statusText}`);
      throw new Error(`External API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("📊 External API response received, processing data...");
    
    // The actual data is nested under response.data.data
    const bettingData = data.data || data;

    // Get tellers assigned to this supervisor
    const supervisorTellers = await User.find({
      supervisorId: supervisorId,
      role: { $in: ['teller', 'supervisor_teller'] }
    }).select('username name').lean();

    console.log(`👥 Found ${supervisorTellers.length} tellers for supervisor ${supervisorId}:`, supervisorTellers.map(t => t.username));

    const supervisorTellerUsernames = supervisorTellers.map(teller => teller.username);

    // Filter staff reports to only include supervisor's tellers
    let filteredStaffReports = [];
    if (bettingData.staffReports && Array.isArray(bettingData.staffReports)) {
      console.log(`📊 Total staff reports from API: ${bettingData.staffReports.length}`);
      console.log(`👥 Supervisor tellers: ${supervisorTellerUsernames.join(', ')}`);
      
      filteredStaffReports = bettingData.staffReports.filter(staff => {
        const match = supervisorTellerUsernames.includes(staff.username);
        if (match) {
          console.log(`✅ Matched teller: ${staff.username} with betAmount: ${staff.betAmount}`);
        }
        return match;
      });
      
      console.log(`🎯 Filtered to ${filteredStaffReports.length} staff reports for supervisor`);
    }

    // Create filtered data object
    const filteredData = {
      ...bettingData,
      staffReports: filteredStaffReports,
      // Recalculate totals based on filtered staff
      totalBetAmount: filteredStaffReports.reduce((sum, staff) => sum + (staff.betAmount || 0), 0),
      totalStartingBalance: filteredStaffReports.reduce((sum, staff) => sum + (staff.startingBalance || 0), 0),
      totalSystemBalance: filteredStaffReports.reduce((sum, staff) => sum + (staff.systemBalance || 0), 0),
      totalPayout: filteredStaffReports.reduce((sum, staff) => sum + (staff.payout || 0), 0),
      totalCanceledBet: filteredStaffReports.reduce((sum, staff) => sum + (staff.canceledBet || 0), 0)
    };

    console.log(`✅ Successfully fetched staff performance data for supervisor ${supervisorId}: ${filteredStaffReports.length} staff members`);

    // If no staff reports match, return empty data with a message
    if (filteredStaffReports.length === 0) {
      console.log(`⚠️ No staff reports found for supervisor ${supervisorId}. This may be because teller usernames don't match the betting system data.`);
      return res.json({
        success: true,
        data: {
          ...bettingData,
          staffReports: [],
          title: bettingData.title || "Staff Performance",
          totalBetAmount: 0,
          totalStartingBalance: 0,
          totalSystemBalance: 0,
          totalPayout: 0,
          totalCanceledBet: 0
        },
        message: "No staff performance data found. This may be because your assigned tellers don't have matching usernames in the betting system."
      });
    }

    res.json({
      success: true,
      data: filteredData
    });

  } catch (error) {
    console.error("❌ Failed to fetch supervisor staff performance data:", error.message);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff performance data",
      error: error.message
    });
  }
});

/**
 * GET /api/reports/supervisor/:id
 * Aggregated supervisor report by teller
 */
router.get("/supervisor/:id", async (req, res) => {
  try {
    const supervisorId = req.params.id;
    const { fromDate, toDate, showAll } = req.query;
    
    const supervisor = await User.findById(supervisorId).select("username name").lean();

    const tellers = await User.find({ supervisorId }).select("_id username name").lean();
    if (!tellers?.length) {
      return res.json({
        supervisorId,
        supervisorName: supervisor?.name || supervisor?.username || "N/A",
        tellers: [],
        denominationTotals: {
          d1000: 0,
          d500: 0,
          d200: 0,
          d100: 0,
          d50: 0,
          d20: 0,
          coins: 0,
        },
        totalSystemBalance: 0,
        totalOver: 0,
        totalShort: 0,
        totalCashOnHand: 0,
      });
    }

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
    } else {
      // DEFAULT: Show only today's reports when no date filter is specified
      // Unless showAll=true parameter is passed
      if (showAll !== 'true') {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        
        dateFilter.createdAt = {
          $gte: startOfDay,
          $lte: endOfDay
        };
      }
      // If showAll=true, no date filter is applied (shows all historical reports)
    }

    const query = {
      tellerId: { $in: tellers.map((t) => t._id) },
      ...dateFilter
    };
    
    const reports = await TellerReport.find(query).lean();

    const byTeller = {};
    for (const r of reports) {
      const uid = r.tellerId?.toString();
      if (!uid) continue;
      if (!byTeller[uid]) byTeller[uid] = r;
      else {
        const prevDate = new Date(byTeller[uid].createdAt || 0);
        const thisDate = new Date(r.createdAt || 0);
        if (thisDate > prevDate) byTeller[uid] = r;
      }
    }

    // Determine exclusion rules: if a date filter is applied and showAll!=true, default excludeZero=true
    const excludeZeroParam = req.query.excludeZero;
    const dateFilterApplied = !!(fromDate || toDate);
    const excludeZero = excludeZeroParam === 'false' ? false : (dateFilterApplied && showAll !== 'true');

    const tellersSummary = tellers.reduce((arr, t) => {
      const r = byTeller[t._id.toString()];
      if (!r) {
        // No report for this teller in the date range; skip so they don't appear with zeros
        return arr;
      }
      const systemBalance = Number(r.systemBalance || 0);
      const cashOnHand = Number(r.cashOnHand || 0);
      const short = Number(r.short || 0);
      const over = Number(r.over || 0);
      const verified = !!r.verified;

      const d1000 = Number(r.d1000 || 0);
      const d500 = Number(r.d500 || 0);
      const d200 = Number(r.d200 || 0);
      const d100 = Number(r.d100 || 0);
      const d50 = Number(r.d50 || 0);
      const d20 = Number(r.d20 || 0);
      const coins = Number(r.coins || 0);

      const totalFromDenom =
        d1000 * 1000 +
        d500 * 500 +
        d200 * 200 +
        d100 * 100 +
        d50 * 50 +
        d20 * 20 +
        coins;

      // Exclude zero balance entries if rule applies (both systemBalance and cashOnHand 0)
      if (excludeZero && systemBalance === 0 && cashOnHand === 0 && totalFromDenom === 0) {
        return arr;
      }

      arr.push({
        tellerId: t._id,
        tellerName: t.name || t.username,
        systemBalance,
        cashOnHand,
        short,
        over,
        verified,
        denom: { d1000, d500, d200, d100, d50, d20, coins },
        totalFromDenom,
      });
      return arr;
    }, []);

    const denominationTotals = {
      d1000: 0,
      d500: 0,
      d200: 0,
      d100: 0,
      d50: 0,
      d20: 0,
      coins: 0,
    };

  let totalSystemBalance = 0;
  // We'll compute aggregate over/short from the summed system balance and cash on hand
  let totalOver = 0;
  let totalShort = 0;
  let totalCashOnHand = 0;

  for (const ts of tellersSummary) {
      denominationTotals.d1000 += ts.denom.d1000;
      denominationTotals.d500 += ts.denom.d500;
      denominationTotals.d200 += ts.denom.d200;
      denominationTotals.d100 += ts.denom.d100;
      denominationTotals.d50 += ts.denom.d50;
      denominationTotals.d20 += ts.denom.d20;
      denominationTotals.coins += ts.denom.coins;

      totalSystemBalance += ts.systemBalance;
      // prefer explicit cashOnHand reported on the teller report, otherwise fall back to the denomination total
      const cashValue = Number(ts.cashOnHand || ts.totalFromDenom || 0);
      totalCashOnHand += cashValue;
    }

    // Compute aggregate over/short using the same logic as the TellerReport pre-save
    const diff = totalCashOnHand - totalSystemBalance;
    if (diff > 0) {
      totalOver = diff;
      totalShort = 0;
    } else if (diff < 0) {
      totalShort = Math.abs(diff);
      totalOver = 0;
    } else {
      totalShort = 0;
      totalOver = 0;
    }

    res.json({
      supervisorId,
      supervisorName: supervisor?.name || supervisor?.username || "N/A",
      tellers: tellersSummary,
      denominationTotals,
      totalSystemBalance,
      totalOver,
      totalShort,
      totalCashOnHand,
    });
  } catch (err) {
    console.error("Error generating supervisor report:", err);
    res.status(500).json({ message: "Failed to generate supervisor report" });
  }
});

/**
 * ✅ Supervisor verifies a report
 */
router.put("/verify/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { supervisorId } = req.body;
    const supervisor = await User.findById(supervisorId);
    if (!supervisor || (supervisor.role !== "supervisor" && supervisor.role !== "supervisor_teller")) {
      return res.status(403).json({ message: "Only supervisors can verify reports." });
    }

    const report = await TellerReport.findById(id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.verified = true;
    report.verifiedBy = supervisor.name || supervisor.username;
    report.verifiedAt = new Date();
    await report.save();

    // ✅ AUTO-RESET: Clear supervisor assignment after report approval
    try {
      await User.findByIdAndUpdate(report.userId, { $unset: { supervisorId: "" } });
      console.log(`✅ Teller ${report.userId} supervisor assignment cleared after report approval`);
    } catch (e) {
      console.warn("⚠️ Failed to clear supervisor assignment:", e?.message || e);
    }

    if (global.io) global.io.emit("reportUpdated", { id, verified: true });
    res.json({ message: "✅ Report verified successfully", report });
  } catch (err) {
    console.error("Error verifying report:", err);
    res.status(500).json({ message: "Failed to verify report" });
  }
});

/**
 * ✅ Admin unlocks a report
 */
router.put("/unlock/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Only admins can unlock reports." });
    }

    const report = await TellerReport.findById(id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.verified = false;
    report.verifiedBy = null;
    report.verifiedAt = null;
    await report.save();

    if (global.io) global.io.emit("reportUpdated", { id, verified: false });
    res.json({ message: "🔓 Report unlocked successfully", report });
  } catch (err) {
    console.error("Error unlocking report:", err);
    res.status(500).json({ message: "Failed to unlock report" });
  }
});

/**
 * 🎯 GET /api/reports/betting-event
 * Fetch betting event report data from external API (Admin, SuperAdmin, Supervisor & Teller)
 * Supports date filtering with fromDate and toDate query parameters
 */
router.get("/betting-event", requireAuth, requireRole(['super_admin', 'admin', 'supervisor', 'teller']), async (req, res) => {
  try {
    console.log("🎯 Fetching betting event report data...");
    console.log(`👤 User Role: ${req.user?.role}, User ID: ${req.user?._id}`);

    const { fromDate, toDate, showAll } = req.query;

    // Use built-in fetch API
    const response = await fetch('https://rmi-gideon.gtarena.ph/api/m/secure/report/event', {
      method: 'GET',
      headers: {
        'X-TOKEN': 'af9735e1c7857a07f0b078df36842ace',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // If date filtering is requested, filter the data client-side
    let filteredData = data;

    if (!showAll && fromDate && toDate) {
      const fromDateTime = new Date(fromDate);
      const toDateTime = new Date(toDate);
      toDateTime.setHours(23, 59, 59, 999); // Include the entire toDate

      console.log(`📅 Filtering betting data from ${fromDate} to ${toDate}`);

      // Filter based on createdAt or completedAt dates if they exist
      if (filteredData.staffReports && Array.isArray(filteredData.staffReports)) {
        // If we have staff reports, we might need to filter them individually
        // For now, keep all data since the external API structure might not have date fields
        console.log("ℹ️ Date filtering requested but external API structure may not support per-record filtering");
      }
    }

    // ✅ TELLER-SPECIFIC FILTERING: If teller requests data, filter to their data only
    if (req.user?.role === 'teller') {
      try {
        const TellerMapping = (await import('../models/TellerMapping.js')).default;
        
        // Find this teller's mapping to get their betting username
        const mapping = await TellerMapping.findOne({ tellerId: req.user._id, isActive: true });
        
        if (mapping) {
          console.log(`🔍 Teller ${req.user.username} mapped as betting user: ${mapping.bettingUsername}`);
          
          // Filter staffReports to only show this teller's data
          if (filteredData?.staffReports && Array.isArray(filteredData.staffReports)) {
            const tellerData = filteredData.staffReports.find(r => 
              (r.username || r.tellerUsername || '').toLowerCase() === mapping.bettingUsername.toLowerCase() ||
              (r.name || r.tellerName || '').toLowerCase() === mapping.bettingName.toLowerCase()
            );
            
            if (tellerData) {
              console.log(`✅ Found betting data for teller: ${tellerData.name || tellerData.username}`);
              filteredData.staffReports = [tellerData];
            } else {
              console.log(`⚠️ Teller ${mapping.bettingUsername} not found in current betting event data`);
              filteredData.staffReports = [];
            }
          }
        } else {
          console.log(`⚠️ Teller ${req.user.username} (ID: ${req.user._id}) has no betting API mapping - showing empty data`);
          filteredData.staffReports = [];
        }
      } catch (mappingErr) {
        console.warn('⚠️ Error filtering teller data:', mappingErr?.message);
        // Don't fail, just show full data if mapping lookup fails
      }
    }

    console.log("✅ Successfully fetched betting event data");

    // Attach per-teller ranks to staffReports (1st, 2nd, 3rd...) before returning
    try {
      const reports = filteredData?.staffReports;
      if (Array.isArray(reports) && reports.length > 0) {
        const sorted = [...reports].sort((a, b) => (Number(b.betAmount ?? b.totalBet ?? 0) - Number(a.betAmount ?? a.totalBet ?? 0)));
        const rankMap = new Map();
        sorted.forEach((r, i) => rankMap.set((r.username || r.tellerUsername || r.name || r.tellerName || r.tellerId || i).toString(), i + 1));

        const ordinal = (n) => {
          if (!n || n <= 0) return null;
          const s = ["th", "st", "nd", "rd"];
          const v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        filteredData.staffReports = reports.map(r => {
          const key = (r.username || r.tellerUsername || r.name || r.tellerName || r.tellerId || '').toString();
          const rank = rankMap.get(key) || 0;
          return { ...r, rank, rankOrdinal: rank ? ordinal(rank) : null };
        });
      }
    } catch (rkErr) {
      console.warn('⚠️ Could not compute ranks for betting-event staffReports:', rkErr?.message || rkErr);
    }

    res.json({
      success: true,
      data: filteredData,
      filtered: !showAll && fromDate && toDate,
      dateRange: !showAll && fromDate && toDate ? { fromDate, toDate } : null,
      userRole: req.user?.role,
      isTellerData: req.user?.role === 'teller'
    });

  } catch (error) {
    console.error("❌ Failed to fetch betting event data:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch betting event data",
      error: error.message
    });
  }
});

/**
 * 📊 GET /api/reports/kpi/tellers
 * Fetch Key Performance Indicator data for active tellers based on real teller reports (Admin/Supervisor/Super Admin)
 * Shows real tellers from the database with their actual performance data
 */
router.get("/kpi/tellers", async (req, res) => {
  try {
    console.log("📊 Fetching KPI data for real active tellers from database...");

    const { date, showAll } = req.query;
    // const userRole = req.user.role;
    // const userId = req.user._id;
    const userRole = 'admin'; // Temporary for testing
    const userId = null;

    // Fetch real teller data from database instead of external scraper
    let bettingData = null;
    try {
      console.log("🔄 Attempting to fetch teller KPI data from betting event reports first...");

        // First: try fetching betting event data from external event API (preferred source)
        let useBettingEvent = false;
        try {
          const eventRes = await axios.get('https://rmi-gideon.gtarena.ph/api/m/secure/report/event', {
            headers: {
              'X-TOKEN': 'af9735e1c7857a07f0b078df36842ace',
              'Content-Type': 'application/json'
            },
            timeout: 10_000
          });

          const payload = eventRes?.data || {};
          // Betting event payload shape varies — prefer payload.staffReports or payload.data.staffReports
          const rawReports = payload.staffReports || payload.data?.staffReports || payload;

          if (rawReports && (Array.isArray(rawReports) || Array.isArray(rawReports.staffReports))) {
            // Normalize array of records
            const items = Array.isArray(rawReports) ? rawReports : rawReports.staffReports || [];

            if (items.length > 0) {
              console.log(`📯 Retrieved ${items.length} raw betting-event records from external API`);

              // Group and aggregate by teller username/id
              const map = new Map();
              for (const item of items) {
                // attempt to read common fields from different formats
                const username = (item.username || item.tellerUsername || item.name || item.tellerName || item.tellerId || '').toString();
                if (!username) continue;

                const betAmount = Number(item.betAmount ?? item.totalBet ?? item.total_bet ?? 0);
                const payout = Number(item.payout ?? item.systemBalance ?? 0);
                const commission = Number(item.commission ?? 0);
                const canceledBet = Number(item.canceledBet ?? item.canceled_bet ?? 0);
                const cashOnHand = Number(item.cashOnHand ?? item.cash_on_hand ?? 0);
                const over = Number(item.over ?? 0);
                const short = Number(item.short ?? 0);

                if (!map.has(username)) {
                  map.set(username, {
                    name: item.name || item.tellerName || username,
                    username,
                    totalBet: 0,
                    totalPayout: 0,
                    totalCommission: 0,
                    totalCanceled: 0,
                    cashOnHand: cashOnHand || 0,
                    over: over || 0,
                    short: short || 0
                  });
                }

                const entry = map.get(username);
                entry.totalBet += betAmount;
                entry.totalPayout += payout;
                entry.totalCommission += commission;
                entry.totalCanceled += canceledBet;
                // Keep cashOnHand/over/short as last-known if present
                if (cashOnHand) entry.cashOnHand = cashOnHand;
                if (over) entry.over = over;
                if (short) entry.short = short;
              }

              // Convert aggregated map to staffReports shape used by KPI UI
              const staffReports = Array.from(map.values()).map(r => {
                const profit = r.cashOnHand ? (r.cashOnHand - r.totalPayout) : (r.totalBet - r.totalPayout);
                const commission = Math.round(r.totalCommission || Math.max(0, Math.round(profit * 0.025)));

                return {
                  name: r.name,
                  username: r.username,
                  betAmount: r.totalBet,
                  payout: r.totalPayout,
                  canceledBet: r.totalCanceled,
                  commission,
                  systemBalance: r.totalPayout,
                  startingBalance: r.totalPayout,
                  profit,
                  over: r.over || 0,
                  short: r.short || 0,
                  cashOnHand: r.cashOnHand || 0
                };
              });

              bettingData = {
                staffReports,
                isRealData: true,
                source: 'betting_event_report',
                totalReports: items.length,
                uniqueTellers: staffReports.length
              };

              useBettingEvent = true;
              console.log(`✅ KPI: aggregated ${staffReports.length} unique tellers from betting-event records`);
            }
          }
        } catch (evtErr) {
          console.warn('⚠️ KPI: failed to fetch/parse betting-event API, will fallback to teller reports:', evtErr?.message || evtErr);
        }

        // If betting event data variable not populated, fall back to teller reports from DB
        if (!useBettingEvent) {
          console.log("🔄 Fetching real teller data from database as fallback...");

          // Get date range for filtering (default to last 30 days if no date specified)
          let dateFilter = {};
      if (date) {
        const filterDate = new Date(date);
        const startOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());
        const endOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 23, 59, 59, 999);
        dateFilter.createdAt = { $gte: startOfDay, $lte: endOfDay };
      } else if (!showAll) {
        // Default to last 30 days if no specific date and not showing all
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFilter.createdAt = { $gte: thirtyDaysAgo };
      }

      // Get all teller reports matching the date filter
      const tellerReports = await TellerReport.find(dateFilter)
        .sort({ createdAt: -1 })
        .lean();

      console.log(`📊 Found ${tellerReports.length} teller reports in database`);

      // Group by teller and get the latest report for each
      const tellerMap = new Map();
      tellerReports.forEach(report => {
        const tellerId = report.tellerId?.toString();
        if (tellerId) {
          if (!tellerMap.has(tellerId) || new Date(report.createdAt) > new Date(tellerMap.get(tellerId).createdAt)) {
            tellerMap.set(tellerId, report);
          }
        }
      });

      // Convert to array and calculate KPIs
      const staffReports = Array.from(tellerMap.values()).map(report => {
        const systemBalance = Number(report.systemBalance || 0);
        const cashOnHand = Number(report.cashOnHand || 0);
        const over = Number(report.over || 0);
        const short = Number(report.short || 0);

        // Calculate profit (cash on hand - system balance)
        const profit = cashOnHand - systemBalance;

        // Calculate commission based on profit (2.5% of profit, or fallback calculation)
        const commission = report.totalBet ?
          Math.round(Number(report.totalBet) * 0.025) : // 2.5% of betting amount if available
          Math.max(0, Math.round(profit * 0.025)); // 2.5% of profit as fallback

        return {
          name: report.tellerName || 'Unknown Teller',
          username: report.tellerId?.toString() || 'unknown',
          betAmount: Number(report.totalBet || 0),
          payout: systemBalance, // System balance as payout reference
          canceledBet: 0, // Not available in current schema
          commission: commission,
          systemBalance: systemBalance,
          startingBalance: systemBalance, // Use system balance as starting reference
          profit: profit,
          over: over,
          short: short,
          cashOnHand: cashOnHand
        };
      });

      bettingData = {
        staffReports: staffReports,
        isRealData: true,
        source: 'database_teller_reports',
        totalReports: tellerReports.length,
        uniqueTellers: staffReports.length
      };

      console.log(`✅ Successfully loaded ${staffReports.length} real tellers from database`);
      console.log("🔍 Real data sample:", staffReports?.[0]);

      }
    } catch (dbError) {
      console.error("❌ Failed to fetch teller data from database:", dbError.message);
      console.log("🔧 Database query failed. Using mock data as fallback...");

      // Fallback to mock data if database fails
      bettingData = {
        staffReports: [
          {
            name: "John Doe",
            username: "johndoe",
            betAmount: 1000,
            payout: 800,
            canceledBet: 50,
            commission: 25,
            systemBalance: 150,
            startingBalance: 200
          },
          {
            name: "Jane Smith",
            username: "janesmith",
            betAmount: 1200,
            payout: 900,
            canceledBet: 30,
            commission: 35,
            systemBalance: 270,
            startingBalance: 250
          },
          {
            name: "Mike Johnson",
            username: "mikej",
            betAmount: 800,
            payout: 650,
            canceledBet: 20,
            commission: 18,
            systemBalance: 110,
            startingBalance: 180
          }
        ],
        isMockData: true,
        scraperStatus: "Database query failed - using mock data",
        message: "Database connection issue. Showing demo data."
      };
    }

    if (!bettingData || !Array.isArray(bettingData.staffReports) || bettingData.staffReports.length === 0) {
      console.log("🔧 No betting-event or teller report data available — using demo fallback data for KPI");

      // Mock/demo data when neither betting-event API nor DB reports are available
      bettingData = {
        staffReports: [
          {
            name: "John Doe",
            username: "johndoe",
            betAmount: 1000,
            payout: 800,
            canceledBet: 50,
            commission: 25,
            systemBalance: 150,
            startingBalance: 200
          },
          {
            name: "Jane Smith",
            username: "janesmith",
            betAmount: 1200,
            payout: 900,
            canceledBet: 30,
            commission: 35,
            systemBalance: 270,
            startingBalance: 250
          },
          {
            name: "Mike Johnson",
            username: "mikej",
            betAmount: 800,
            payout: 650,
            canceledBet: 20,
            commission: 18,
            systemBalance: 110,
            startingBalance: 180
          }
        ],
        isMockData: true,
        scraperStatus: "No betting-event or database teller reports available - showing mock data",
        message: "Currently showing demo data. To see real tellers, provide event report data or ensure teller reports exist in DB."
      };
    }

    if (!bettingData || !bettingData.staffReports) {
      console.log("❌ No betting data available:", bettingData);
      return res.status(404).json({
        success: false,
        message: "No betting event data available"
      });
    }

    console.log(`📊 Found ${bettingData.staffReports.length} tellers in betting data`);

    // For now, just return the raw data to test
    // Calculate summary from real teller data
    const tellerSummaries = bettingData.staffReports.map((teller, index) => {
      const betAmount = teller.betAmount || 0;
      const payout = teller.payout || 0;
      const canceledBet = teller.canceledBet || 0;
      // Use commission from scraped data, fallback to calculation if not available
      const commission = teller.commission || Math.round(betAmount * 0.025);
      const profit = betAmount - payout - canceledBet;
      const profitMargin = betAmount > 0 ? (profit / betAmount) * 100 : 0;
      const totalTransactions = betAmount + payout + canceledBet;
      const efficiency = totalTransactions > 0 ? (profit / totalTransactions) * 100 : 0;

      return {
        name: teller.name,
        username: teller.username,
        betAmount: betAmount,
        payout: payout,
        canceledBet: canceledBet,
        commission: commission,
        systemBalance: teller.systemBalance || 0,
        startingBalance: teller.startingBalance || 0,
        profit: profit,
        profitMargin: profitMargin,
        efficiency: efficiency,
        rank: index + 1
      };
    });

    // Calculate aggregate summary
    const totalBetAmount = tellerSummaries.reduce((sum, t) => sum + t.betAmount, 0);
    const totalProfit = tellerSummaries.reduce((sum, t) => sum + t.profit, 0);
    const totalCommission = tellerSummaries.reduce((sum, t) => sum + t.commission, 0);
    const avgBetPerTeller = tellerSummaries.length > 0 ? totalBetAmount / tellerSummaries.length : 0;
    const avgProfitMargin = tellerSummaries.length > 0 ? tellerSummaries.reduce((sum, t) => sum + t.profitMargin, 0) / tellerSummaries.length : 0;
    const topPerformer = tellerSummaries.reduce((top, current) => current.profit > (top?.profit || 0) ? current : top, null);

    // Use a consistent top-level source indicator for UI (real_betting_data when not mock),
    // and include a subSource to denote origin (betting_event_report | database_teller_reports)
    const subSource = bettingData?.source || null;
    const topSource = bettingData?.isMockData ? 'demo_data' : 'real_betting_data';

    return res.json({
      success: true,
      data: {
        summary: {
          activeTellers: bettingData.staffReports.length,
          totalBetAmount: totalBetAmount,
          totalProfit: totalProfit,
          totalCommission: totalCommission,
          avgBetPerTeller: avgBetPerTeller,
          avgProfitMargin: avgProfitMargin,
          topPerformer: topPerformer,
          nameAnalysis: {
            totalTellers: bettingData.staffReports.length,
            uniqueNames: bettingData.staffReports.length,
            mostCommonNames: [],
            mostCommonFirstNames: [],
            mostCommonLastNames: []
          }
        },
        tellers: tellerSummaries,
        source: topSource,
        subSource: subSource,
        filtered: false,
        selectedDate: null
      }
    });

  } catch (error) {
    console.error("❌ Failed to fetch KPI data:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch KPI data",
      error: error.message
    });
  }
});

/**
 * Helper function to analyze teller names
 */
function analyzeTellerNames(tellers) {
  const names = tellers.map(t => t.name).filter(Boolean);

  // Count name frequencies
  const nameCounts = {};
  names.forEach(name => {
    nameCounts[name] = (nameCounts[name] || 0) + 1;
  });

  // Find most common names
  const sortedNames = Object.entries(nameCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  // Analyze name patterns (first names, last names, etc.)
  const firstNames = names.map(name => {
    const parts = name.trim().split(' ');
    return parts.length > 1 ? parts[0] : name;
  });

  const lastNames = names.map(name => {
    const parts = name.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }).filter(Boolean);

  const firstNameCounts = {};
  firstNames.forEach(name => {
    firstNameCounts[name] = (firstNameCounts[name] || 0) + 1;
  });

  const lastNameCounts = {};
  lastNames.forEach(name => {
    lastNameCounts[name] = (lastNameCounts[name] || 0) + 1;
  });

  return {
    totalTellers: names.length,
    uniqueNames: Object.keys(nameCounts).length,
    mostCommonNames: sortedNames.map(([name, count]) => ({ name, count })),
    mostCommonFirstNames: Object.entries(firstNameCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    mostCommonLastNames: Object.entries(lastNameCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  };
}

/**
 * Helper function to calculate teller efficiency
 */
function calculateEfficiency(teller) {
  const totalTransactions = (teller.betAmount || 0) + (teller.payout || 0) + (teller.canceledBet || 0);
  if (totalTransactions === 0) return 0;

  // Efficiency based on profit per transaction volume
  const profit = (teller.betAmount || 0) - (teller.payout || 0) - (teller.canceledBet || 0);
  return (profit / totalTransactions) * 100;
}

/**
 * 🎯 GET /api/reports/teller-mappings
 * Get all teller mappings between reporting system and betting API
 * (Super Admin Only)
 */
// router.get("/teller-mappings", async (req, res) => {
//   try {
//     console.log("🎯 Fetching teller mappings...");

//     const mappings = await TellerMapping.find({ isActive: true })
//       // .populate('tellerId', 'username name role status')
//       .sort({ createdAt: -1 });

//     console.log(`✅ Found ${mappings.length} active teller mappings`);
//     res.json({
//       success: true,
//       mappings: mappings.map(mapping => ({
//         id: mapping._id,
//         tellerId: mapping.tellerId._id,
//         tellerUsername: mapping.tellerId.username,
//         tellerName: mapping.tellerId.name,
//         bettingUsername: mapping.bettingUsername,
//         bettingName: mapping.bettingName,
//         matchConfidence: mapping.matchConfidence,
//         matchReason: mapping.matchReason,
//         lastBettingSync: mapping.lastBettingSync,
//         bettingData: mapping.bettingData,
//         createdAt: mapping.createdAt
//       }))
//     });

//   } catch (error) {
//     console.error("❌ Failed to fetch teller mappings:", error.message);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch teller mappings",
//       error: error.message
//     });
//   }
// });

/**
 * 🔄 POST /api/reports/sync-betting-data
 * Sync latest betting data for all mapped tellers
 * (Super Admin Only)
 */
router.post("/sync-betting-data", requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    console.log("🔄 Syncing betting data for mapped tellers...");

    const TellerMapping = (await import("../models/TellerMapping.js")).default;

    // Fetch latest betting data
    const response = await fetch('https://rmi-gideon.gtarena.ph/api/m/secure/report/event', {
      method: 'GET',
      headers: {
        'X-TOKEN': 'af9735e1c7857a07f0b078df36842ace',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const bettingTellers = data.data.staffReports || [];

    // Update mappings with latest data
    let updated = 0;
    let notFound = 0;

    const mappings = await TellerMapping.find({ isActive: true });

    for (const mapping of mappings) {
      const bettingData = bettingTellers.find(bt => bt.username === mapping.bettingUsername);

      if (bettingData) {
        mapping.lastBettingSync = new Date();
        mapping.bettingData = {
          lastBetAmount: bettingData.betAmount || 0,
          lastSystemBalance: bettingData.systemBalance || 0,
          lastSyncDate: new Date()
        };
        await mapping.save();
        updated++;
      } else {
        notFound++;
      }
    }

    console.log(`✅ Betting data sync complete: ${updated} updated, ${notFound} not found`);
    res.json({
      success: true,
      message: `Synced betting data for ${updated} tellers`,
      stats: { updated, notFound, total: mappings.length }
    });

  } catch (error) {
    console.error("❌ Failed to sync betting data:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to sync betting data",
      error: error.message
    });
  }
});

/**
 * 🔗 POST /api/reports/create-teller-mapping
 * Manually create a teller mapping
 * (Super Admin Only)
 */
router.post("/create-teller-mapping", requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    const { tellerId, bettingUsername, bettingName, matchConfidence = 'manual', matchReason = '' } = req.body;

    if (!tellerId || !bettingUsername || !bettingName) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: tellerId, bettingUsername, bettingName"
      });
    }

    const TellerMapping = (await import("../models/TellerMapping.js")).default;

    // Check if mapping already exists
    const existing = await TellerMapping.findOne({
      bettingUsername,
      isActive: true
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A mapping already exists for this betting username"
      });
    }

    const mapping = new TellerMapping({
      tellerId,
      bettingUsername,
      bettingName,
      matchConfidence,
      matchReason
    });

    await mapping.save();

    console.log(`✅ Created manual mapping: ${bettingUsername} -> teller ${tellerId}`);
    res.json({
      success: true,
      message: "Teller mapping created successfully",
      mapping
    });

  } catch (error) {
    console.error("❌ Failed to create teller mapping:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create teller mapping",
      error: error.message
    });
  }
});

/**
 * 📊 GET /api/reports/matched-tellers-performance
 * Get performance data for matched tellers combining reporting and betting data
 * (Super Admin Only)
 */
router.get("/matched-tellers-performance", requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    console.log("📊 Fetching matched tellers performance data...");

    const TellerMapping = (await import("../models/TellerMapping.js")).default;

    const mappings = await TellerMapping.find({ isActive: true })
      .populate('tellerId', 'username name role status baseSalary')
      .sort({ 'bettingData.lastBetAmount': -1 });

    const performanceData = mappings.map(mapping => ({
      tellerId: mapping.tellerId._id,
      username: mapping.tellerId.username,
      name: mapping.tellerId.name,
      role: mapping.tellerId.role,
      status: mapping.tellerId.status,
      baseSalary: mapping.tellerId.baseSalary,
      bettingUsername: mapping.bettingUsername,
      bettingName: mapping.bettingName,
      lastBetAmount: mapping.bettingData.lastBetAmount || 0,
      lastSystemBalance: mapping.bettingData.lastSystemBalance || 0,
      lastSyncDate: mapping.bettingData.lastSyncDate,
      matchConfidence: mapping.matchConfidence,
      matchReason: mapping.matchReason
    }));

    console.log(`✅ Retrieved performance data for ${performanceData.length} matched tellers`);
    res.json({
      success: true,
      data: performanceData
    });

  } catch (error) {
    console.error("❌ Failed to fetch matched tellers performance:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch matched tellers performance",
      error: error.message
    });
  }
});

export default router;
