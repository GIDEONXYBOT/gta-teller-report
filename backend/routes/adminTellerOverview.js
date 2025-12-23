// Admin teller overview route - provides complete daily teller data with date filtering
import express from "express";
import User from "../models/User.js";
import TellerReport from "../models/TellerReport.js";
import Withdrawal from "../models/Withdrawal.js";
import Capital from "../models/Capital.js";
import Transaction from "../models/Transaction.js";
import { DateTime } from "luxon";

const router = express.Router();

/**
 * GET /api/admin/teller-overview
 * Get comprehensive teller data for a specific date or date range with summary
 */
router.get("/teller-overview", async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    
    // Determine date range for querying
    let queryStartOfDay, queryEndOfDay, targetDate;
    
    if (startDate && endDate) {
      // Use provided date range for historical view
      queryStartOfDay = DateTime.fromFormat(startDate, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).startOf('day').toUTC();
      queryEndOfDay = DateTime.fromFormat(endDate, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).plus({ days: 1 }).startOf('day').toUTC();
      targetDate = `${startDate} to ${endDate}`;
    } else {
      // Use single date (backward compatibility)
      targetDate = date || DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
      const targetDay = DateTime.fromFormat(targetDate, "yyyy-MM-dd", { zone: "Asia/Manila" });
      queryStartOfDay = targetDay.startOf("day").toUTC();
      queryEndOfDay = queryStartOfDay.plus({ days: 1 });
    }
    
    console.log(`📊 Admin fetching teller overview for date: ${targetDate}`);

    // Get all tellers and supervisors with their basic info
    const users = await User.find({ 
      role: { $in: ["teller", "supervisor"] },
      status: "approved" 
    }).select("_id username name status role supervisorId").lean();

    console.log(`👥 Found ${users.length} users in database (${users.filter(u => u.role === 'teller').length} tellers, ${users.filter(u => u.role === 'supervisor').length} supervisors)`);

    if (!users.length) {
      console.log("⚠️ No users found, returning empty data");
      return res.json({
        success: true,
        tellers: [],
        summary: {
          totalUsers: 0,
          totalCapital: 0,
          totalRemittances: 0,
          totalWithdrawals: 0,
          activeTellers: 0
        },
        date: targetDate
      });
    }

    const tellerIds = users.filter(u => u.role === 'teller').map(u => u._id);
    const supervisorIds = users.filter(u => u.role === 'supervisor').map(u => u._id);
    
    // Get teller reports for the date (or date range - use the start date for backward compatibility)
    const singleDate = startDate || date || DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
    const tellerReports = await TellerReport.find({
      tellerId: { $in: tellerIds },
      date: singleDate
    }).lean();

    // Get capital records for each teller (get ACTIVE records, regardless of date)
    const activeCapitals = await Capital.find({
      tellerId: { $in: tellerIds },
      status: "active"
    }).lean();

    console.log(`💰 Found ${activeCapitals.length} active capital records`);
    if (activeCapitals.length > 0) {
      console.log(`💰 Sample capital record:`, {
        tellerId: activeCapitals[0].tellerId,
        amount: activeCapitals[0].amount,
        totalAdditional: activeCapitals[0].totalAdditional,
        totalRemitted: activeCapitals[0].totalRemitted,
        createdAt: activeCapitals[0].createdAt
      });
    }

    // Get transactions for the date range to see additional capital and remittances
    // queryStartOfDay and queryEndOfDay are already set at the beginning of the function

    const transactions = await Transaction.find({
      tellerId: { $in: tellerIds },
      createdAt: {
        $gte: queryStartOfDay.toJSDate(),
        $lt: queryEndOfDay.toJSDate()
      }
    }).lean();

    console.log(`📋 Found ${transactions.length} transactions for ${targetDate}`);
    if (transactions.length > 0) {
      const transactionTypes = transactions.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {});
      console.log(`📋 Transaction types:`, transactionTypes);
    }

    // Get supervisor information
    const supervisorIdsFromTellers = users.filter(u => u.role === 'teller').map(t => t.supervisorId).filter(Boolean);
    const supervisors = await User.find({ 
      _id: { $in: supervisorIdsFromTellers },
      role: 'supervisor'
    }).select('_id name username').lean();

    // Process data for each user (teller or supervisor)
    const userData = users.map(user => {
      const userReportsForDay = user.role === 'teller' 
        ? tellerReports.filter(r => r.tellerId.toString() === user._id.toString())
        : []; // Supervisors don't have teller reports
      
      const userCapital = activeCapitals.filter(c => c.tellerId.toString() === user._id.toString());
      const userTransactions = transactions.filter(t => t.tellerId.toString() === user._id.toString());

      // Get supervisor details (only applicable for tellers)
      const supervisor = user.role === 'teller' ? supervisors.find(s => s._id.toString() === user.supervisorId?.toString()) : null;

      // 🔧 FIXED: Calculate using ACTIVE Capital model fields
      // Get the active capital record for this user
      const activeCapital = userCapital.length > 0 ? userCapital[0] : null;

      // Base capital: immutable starting capital from Capital model
      const baseCapital = activeCapital?.amount || 0;

      // Additional capital: from Capital model totalAdditional field
      const additionalCapital = activeCapital?.totalAdditional || 0;

      // Remitted: from Capital model totalRemitted field
      const remittanceFromCapital = activeCapital?.totalRemitted || 0;

      // Additional capital transactions count (for reference)
      const additionalCapitalTransactions = userTransactions.filter(t => t.type === 'additional');

      // totalCapitalDeployed = base + additional
      const totalCapitalDeployed = baseCapital + additionalCapital;

      // Calculate remittances from user reports and capital records
      const totalReportRemittances = userReportsForDay.reduce((sum, report) => {
        return sum + (report.remittance || 0);
      }, 0);

      // Use remittanceFromCapital from Capital model (totalRemitted field)
      const totalRemittances = remittanceFromCapital;

      // Simple balance calculation: Capital + Additional - Remittances = Balance
      const totalDeployed = totalCapitalDeployed; // Base + Additional
      const balance = totalDeployed - totalRemittances;

      // Get activity timestamps
      const lastReport = userReportsForDay.length > 0
        ? userReportsForDay.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0]
        : null;

      const lastCapitalTime = userCapital.length > 0
        ? DateTime.fromJSDate(new Date(Math.max(...userCapital.map(c => new Date(c.createdAt)))))
            .setZone("Asia/Manila")
            .toFormat("h:mm a")
        : null;

      const lastActivity = lastReport
        ? DateTime.fromJSDate(new Date(lastReport.createdAt || lastReport.date))
            .setZone("Asia/Manila")
            .toFormat("h:mm a")
        : (lastCapitalTime || 'No activity');

      // Activity flags
      // Show if there are ANY TRANSACTIONS TODAY or capital CREATED TODAY
      const manilaStart = DateTime.fromFormat(targetDate, 'yyyy-MM-dd', { zone: 'Asia/Manila' }).startOf('day');
      const manilaEnd = manilaStart.plus({ days: 1 });
      const capitalCreatedToday = !!activeCapital && DateTime.fromJSDate(activeCapital.createdAt).setZone('Asia/Manila') >= manilaStart && DateTime.fromJSDate(activeCapital.createdAt).setZone('Asia/Manila') < manilaEnd;
      const hasTransactionsToday = userTransactions.length > 0;
      const hasReports = userReportsForDay.length > 0;
      const hasActivity = hasReports || totalRemittances > 0;

      // Transaction counts
      const capitalTransactions = userTransactions.filter(t => t.type === 'capital');
      const remittanceTransactions = userTransactions.filter(t => t.type === 'remittance');
      const transactionCounts = {
        capitalTransactions: capitalTransactions.length,
        additionalTransactions: additionalCapitalTransactions.length,
        remittanceTransactions: remittanceTransactions.length,
        reportTransactions: userReportsForDay.length
      };

      // Calculate today's additional and remittance amounts
      const additionalToday = additionalCapitalTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const remittanceToday = remittanceTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

      return {
        ...user,
        supervisor: supervisor ? {
          _id: supervisor._id,
          name: supervisor.name,
          username: supervisor.username
        } : null,
        
        // Active capital record for transaction availability checks
        activeCapital: activeCapital,
        
        // Separated capital flow: Base Capital | Additional Capital | Remittances | Balance
        baseCapital: baseCapital,
        additionalCapital: additionalCapital,
        additionalCount: additionalCapitalTransactions.length,
        totalCapitalDeployed: totalCapitalDeployed, // Sum of base + additional
        totalRemittances: totalRemittances,
        remittanceCount: remittanceTransactions.length + userReportsForDay.length,
        balance: balance,
        additionalToday: additionalToday,
        remittanceToday: remittanceToday,
        lastActivity: lastActivity,
        hasActivity: hasActivity,
        hasTransactionsToday: hasTransactionsToday,
        capitalCreatedToday: capitalCreatedToday,
        showToday: hasTransactionsToday || capitalCreatedToday
      };
    })
    // Remove the showToday filter - admin should see all users
    // .filter(user => user.showToday);

    // Calculate separated summary: Base Capital | Additional Capital | Remittances | Balance
    const summary = {
      totalUsers: userData.length,
      activeTellers: userData.filter(u => u.hasActivity).length,
      
      // Separated capital flow
      totalBaseCapital: userData.reduce((sum, u) => sum + (u.baseCapital || 0), 0),
      totalAdditionalCapital: userData.reduce((sum, u) => sum + (u.additionalCapital || 0), 0),
      totalAdditionalCount: userData.reduce((sum, u) => sum + (u.additionalCount || 0), 0),
      totalCapitalDeployed: userData.reduce((sum, u) => sum + (u.totalCapitalDeployed || 0), 0),
      totalRemittances: userData.reduce((sum, u) => sum + (u.totalRemittances || 0), 0),
      totalRemittanceCount: userData.reduce((sum, u) => sum + (u.remittanceCount || 0), 0),
      totalBalance: userData.reduce((sum, u) => sum + (u.balance || 0), 0)
    };

    // Sort by total capital deployed (highest first)
    userData.sort((a, b) => (b.totalCapitalDeployed || 0) - (a.totalCapitalDeployed || 0));

    console.log(`✅ Admin overview processed: ${userData.length} users (${userData.filter(u => u.role === 'teller').length} tellers, ${userData.filter(u => u.role === 'supervisor').length} supervisors) with capital today, ${summary.activeTellers} active`);

    res.json({
      success: true,
      tellers: userData,
      summary: summary,
      date: targetDate
    });

  } catch (error) {
    console.error("❌ Error fetching admin teller overview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch teller overview",
      error: error.message
    });
  }
});

/**
 * GET /api/admin/teller-overview/export
 * Export teller overview data as CSV
 */
router.get("/teller-overview/export", async (req, res) => {
  try {
    const { date, format = 'csv' } = req.query;
    const targetDate = date || DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
    
    // Reuse the same logic as the main overview endpoint
    // (Implementation would be similar to above but formatted for export)
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="teller-overview-${targetDate}.csv"`);
    
    // For now, redirect to the main endpoint - frontend handles CSV export
    res.redirect(`/api/admin/teller-overview?date=${targetDate}`);
    
  } catch (error) {
    console.error("❌ Error exporting teller overview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export teller overview",
      error: error.message
    });
  }
});

export default router;