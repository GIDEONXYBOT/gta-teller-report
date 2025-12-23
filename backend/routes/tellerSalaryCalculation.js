import express from 'express';
import Payroll from '../models/Payroll.js';
import User from '../models/User.js';
import TellerReport from '../models/TellerReport.js';
import { requireAuth } from '../middleware/auth.js';
import SystemSettings from '../models/SystemSettings.js';

const router = express.Router();

// Default threshold for flagging "over" amounts (in currency units)
const DEFAULT_OVER_THRESHOLD = 500;

/**
 * GET /api/teller-salary-calculation
 * Fetch teller salary calculation with overtime and base salary for a given week
 * Only accessible to superadmin and supervisors
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    // Check user role
    const userRole = req.user?.role;
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin' || req.user?.username === 'admin';
    const isSupervisor = userRole === 'supervisor';

    if (!isSuperAdmin && !isSupervisor) {
      return res.status(403).json({ message: 'Access denied. Only superadmin and supervisors can view this report.' });
    }

    const { weekStart, weekEnd, supervisorId, flagThreshold } = req.query;

    if (!weekStart || !weekEnd) {
      return res.status(400).json({ message: 'weekStart and weekEnd are required' });
    }

    // Parse dates and convert to string format (YYYY-MM-DD)
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    const startDateStr = weekStart;
    const endDateStr = weekEnd;

    // If supervisor, filter by their assigned tellers
    let tellerFilter = {};
    if (isSupervisor) {
      tellerFilter = { supervisor_id: req.user.id };
    } else if (supervisorId && isSuperAdmin) {
      tellerFilter = { supervisor_id: supervisorId };
    }

    // Fetch users who are tellers based on filter
    const tellers = await User.find({
      role: 'teller',
      ...tellerFilter
    }).lean();
    
    const tellerIds = tellers.map(t => t._id);

    if (tellerIds.length === 0) {
      return res.json({ tellers: [], message: 'No tellers found' });
    }

    // Fetch teller reports for the week to get 'over' amounts
    // Note: TellerReport.date is a String in format YYYY-MM-DD
    const tellerReports = await TellerReport.find({
      date: { $gte: startDateStr, $lte: endDateStr },
      tellerId: { $in: tellerIds }
    }).lean();

    // Get threshold for flagging over amounts
    let overThreshold = DEFAULT_OVER_THRESHOLD;
    if (flagThreshold) {
      overThreshold = Number(flagThreshold);
    } else {
      // Try to get from system settings
      const settings = await SystemSettings.findOne().lean();
      if (settings?.overAmountThreshold) {
        overThreshold = settings.overAmountThreshold;
      }
    }

    // Group by teller and calculate over amounts per day
    const tellerMap = {};
    const flaggedReports = []; // Auto-detected reports with over amounts

    tellers.forEach(teller => {
      tellerMap[teller._id.toString()] = {
        id: teller._id,
        name: teller.name || 'Unknown',
        baseSalary: teller.baseSalary || 0,
        over: {
          mon: 0,
          tue: 0,
          wed: 0,
          thu: 0,
          fri: 0,
          sat: 0,
          sun: 0
        },
        overAmounts: [], // Track actual over amounts per day
        hasExcessiveOver: false // Flag if any day exceeds threshold
      };
    });

    // Process teller reports
    tellerReports.forEach(report => {
      const tellerIdStr = report.tellerId?.toString();
      if (tellerMap[tellerIdStr]) {
        // Parse the date string to get day of week (without timezone conversion)
        const dateParts = report.date.split('-');
        const date = new Date(dateParts[0], parseInt(dateParts[1]) - 1, dateParts[2]);
        const dayOfWeek = date.getDay();
        
        // Map day of week to day name (1=Mon, 2=Tue, etc.)
        let dayKey = '';
        switch (dayOfWeek) {
          case 1: dayKey = 'mon'; break;
          case 2: dayKey = 'tue'; break;
          case 3: dayKey = 'wed'; break;
          case 4: dayKey = 'thu'; break;
          case 5: dayKey = 'fri'; break;
          case 6: dayKey = 'sat'; break;
          case 0: dayKey = 'sun'; break;
          default: break;
        }

        if (dayKey) {
          const overAmount = report.over || 0;
          // Add over amount from teller report
          tellerMap[tellerIdStr].over[dayKey] += overAmount;
          
          // Track all over amounts for detection
          if (overAmount > 0) {
            tellerMap[tellerIdStr].overAmounts.push({
              date: report.date,
              day: dayKey,
              amount: overAmount,
              isExcessive: overAmount > overThreshold,
              report: {
                id: report._id,
                systemBalance: report.systemBalance,
                cashOnHand: report.cashOnHand
              }
            });
            
            // Auto-detect: flag if over amount exceeds threshold
            if (overAmount > overThreshold) {
              tellerMap[tellerIdStr].hasExcessiveOver = true;
              flaggedReports.push({
                tellerId: report.tellerId,
                tellerName: report.tellerName,
                date: report.date,
                overAmount: overAmount,
                threshold: overThreshold,
                excessAmount: overAmount - overThreshold,
                reportId: report._id,
                systemBalance: report.systemBalance,
                cashOnHand: report.cashOnHand
              });
            }
          }
        }
      }
    });

    const result = Object.values(tellerMap);

    res.json({
      tellers: result,
      weekStart,
      weekEnd,
      count: result.length,
      overThreshold,
      flaggedReports, // Auto-detected excessive over amounts
      flaggedCount: flaggedReports.length,
      summary: {
        totalTellers: result.length,
        tellersWithOver: result.filter(t => Object.values(t.over).some(v => v > 0)).length,
        tellersWithExcessiveOver: result.filter(t => t.hasExcessiveOver).length
      }
    });
  } catch (err) {
    console.error('Error fetching teller salary calculation:', err);
    res.status(500).json({ message: 'Failed to fetch salary calculation', error: err.message });
  }
});

/**
 * GET /api/teller-salary-calculation/flagged-reports/:date
 * Get reports with excessive over amounts for a specific date or date range
 * Auto-detection endpoint
 */
router.get('/flagged-reports/:dateOrRange', requireAuth, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin' || req.user?.username === 'admin';
    const isSupervisor = userRole === 'supervisor';

    if (!isSuperAdmin && !isSupervisor) {
      return res.status(403).json({ message: 'Access denied. Only superadmin and supervisors can view flagged reports.' });
    }

    const { dateOrRange } = req.params;
    const { threshold, supervisorId } = req.query;

    // Get threshold
    let overThreshold = DEFAULT_OVER_THRESHOLD;
    if (threshold) {
      overThreshold = Number(threshold);
    } else {
      const settings = await SystemSettings.findOne().lean();
      if (settings?.overAmountThreshold) {
        overThreshold = settings.overAmountThreshold;
      }
    }

    // Parse date range (format: YYYY-MM-DD or YYYY-MM-DD:YYYY-MM-DD)
    let startDate, endDate;
    if (dateOrRange.includes(':')) {
      [startDate, endDate] = dateOrRange.split(':');
    } else {
      startDate = dateOrRange;
      endDate = dateOrRange;
    }

    // Build query
    const query = {
      date: { $gte: startDate, $lte: endDate },
      over: { $gt: overThreshold }
    };

    // Filter by supervisor if provided
    if (supervisorId && isSuperAdmin) {
      query.supervisorId = supervisorId;
    } else if (isSupervisor) {
      query.supervisorId = req.user.id;
    }

    // Find flagged reports
    const flaggedReports = await TellerReport.find(query)
      .populate('tellerId', 'name username baseSalary')
      .populate('supervisorId', 'name username')
      .sort({ date: -1, over: -1 })
      .lean();

    // Format response with excess amounts
    const formattedReports = flaggedReports.map(report => ({
      reportId: report._id,
      date: report.date,
      tellerName: report.tellerName || report.tellerId?.name,
      teller: {
        id: report.tellerId?._id,
        name: report.tellerId?.name,
        username: report.tellerId?.username,
        baseSalary: report.tellerId?.baseSalary
      },
      supervisor: {
        id: report.supervisorId?._id,
        name: report.supervisorId?.name,
        username: report.supervisorId?.username
      },
      overAmount: report.over,
      threshold: overThreshold,
      excessAmount: report.over - overThreshold,
      systemBalance: report.systemBalance,
      cashOnHand: report.cashOnHand,
      short: report.short,
      isAutoFlagged: true
    }));

    res.json({
      success: true,
      dateRange: {
        start: startDate,
        end: endDate
      },
      threshold: overThreshold,
      flaggedCount: formattedReports.length,
      reports: formattedReports,
      summary: {
        totalExcessAmount: formattedReports.reduce((sum, r) => sum + r.excessAmount, 0),
        averageExcess: formattedReports.length > 0 
          ? formattedReports.reduce((sum, r) => sum + r.excessAmount, 0) / formattedReports.length
          : 0,
        highestExcess: formattedReports.length > 0
          ? Math.max(...formattedReports.map(r => r.excessAmount))
          : 0
      }
    });

  } catch (err) {
    console.error('Error fetching flagged reports:', err);
    res.status(500).json({ message: 'Failed to fetch flagged reports', error: err.message });
  }
});

/**
 * GET /api/teller-salary-calculation/over-summary/:date
 * Get summary of all over amounts for a date, with auto-detection of high amounts
 */
router.get('/over-summary/:date', requireAuth, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'superadmin' || req.user?.username === 'admin';
    const isSupervisor = userRole === 'supervisor';

    if (!isSuperAdmin && !isSupervisor) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { date } = req.params;
    const { supervisorId } = req.query;

    // Get threshold
    const settings = await SystemSettings.findOne().lean();
    const overThreshold = settings?.overAmountThreshold || DEFAULT_OVER_THRESHOLD;

    // Build query
    const query = {
      date: date,
      over: { $gt: 0 }
    };

    if (supervisorId && isSuperAdmin) {
      query.supervisorId = supervisorId;
    } else if (isSupervisor) {
      query.supervisorId = req.user.id;
    }

    // Find all reports with over amounts
    const reports = await TellerReport.find(query)
      .populate('tellerId', 'name username baseSalary')
      .sort({ over: -1 })
      .lean();

    // Categorize reports
    const withinNormal = [];
    const flaggedAsHigh = [];

    reports.forEach(report => {
      const entry = {
        reportId: report._id,
        tellerName: report.tellerName || report.tellerId?.name,
        teller: {
          id: report.tellerId?._id,
          name: report.tellerId?.name,
          username: report.tellerId?.username
        },
        overAmount: report.over,
        systemBalance: report.systemBalance,
        cashOnHand: report.cashOnHand
      };

      if (report.over > overThreshold) {
        entry.excessAmount = report.over - overThreshold;
        entry.isAutoFlagged = true;
        flaggedAsHigh.push(entry);
      } else {
        withinNormal.push(entry);
      }
    });

    res.json({
      success: true,
      date,
      threshold: overThreshold,
      summary: {
        totalReports: reports.length,
        withNormalOver: withinNormal.length,
        withHighOver: flaggedAsHigh.length,
        totalOverAmount: reports.reduce((sum, r) => sum + r.over, 0),
        totalExcess: flaggedAsHigh.reduce((sum, r) => sum + (r.over - overThreshold), 0)
      },
      reportsNormal: withinNormal,
      reportsFlagged: flaggedAsHigh
    });

  } catch (err) {
    console.error('Error fetching over summary:', err);
    res.status(500).json({ message: 'Failed to fetch over summary', error: err.message });
  }
});

/**
 * GET /api/teller-salary-calculation/debug/reports
 * Debug endpoint to see all reports for a date range
 */
router.get('/debug/reports', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate required (YYYY-MM-DD format)' });
    }

    // Find all reports in date range
    const reports = await TellerReport.find({
      date: { $gte: startDate, $lte: endDate }
    })
      .populate('tellerId', 'name username')
      .sort({ date: 1, tellerId: 1 })
      .lean();

    // Group by date to see what we have
    const byDate = {};
    reports.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push({
        teller: r.tellerId?.name || 'Unknown',
        over: r.over,
        short: r.short
      });
    });

    res.json({
      dateRange: { startDate, endDate },
      totalReports: reports.length,
      reportsByDate: byDate,
      allReports: reports
    });

  } catch (err) {
    console.error('Error in debug endpoint:', err);
    res.status(500).json({ message: 'Debug failed', error: err.message });
  }
});

export default router;
