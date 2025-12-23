import express from "express";
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import User from "../models/User.js";
import TellerReport from "../models/TellerReport.js";
import Payroll from "../models/Payroll.js";
import PayrollAuditLog from "../models/PayrollAuditLog.js";
import Cashflow from "../models/Cashflow.js";
import AdminFinance from "../models/AdminFinance.js";
import { sendPayrollUpdateNotification, sendErrorNotification } from '../services/emailService.js';
import bcrypt from "bcrypt";

const router = express.Router();
// ensure admin routes are authenticated
router.use(requireAuth);

/* ========================================================
   👑 ADMIN USER MANAGEMENT ROUTES
======================================================== */

router.get("/users", requirePermission('employees'), async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.put("/approve-user/:id", requirePermission('employees'), async (req, res) => {
  try {
    const { id } = req.params;
    const { active = true, role } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (active !== undefined) user.active = active;
    if (role) user.role = role;
    user.status = active ? "approved" : "pending";

    await user.save();

    if (global.io)
      global.io.emit("userUpdated", { userId: user._id, status: user.status });

    res.json({
      success: true,
      message: `${user.name || user.username} ${active ? "approved" : "deactivated"} successfully.`,
      user,
    });
  } catch (err) {
    console.error("❌ Error approving user:", err);
    res.status(500).json({ message: "Failed to approve user" });
  }
});

router.delete("/user/:id", requirePermission('employees'), async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    if (global.io) global.io.emit("userDeleted", id);
    res.json({ message: "🗑️ User deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting user:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

router.put("/update-user/:id", requirePermission('employees'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, name, username, password, baseSalary } = req.body;

    const updateData = { role, name, username };
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10); // ✅ Hash the password
      updateData.password = hashedPassword;
      updateData.plainTextPassword = password; // ✅ Store plain text for admin
    }
    if (baseSalary !== undefined) {
      updateData.baseSalary = Number(baseSalary) || 0;
    }

    const updated = await User.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: "User not found" });

    if (global.io) global.io.emit("userUpdated", updated);
    res.json({ message: "✅ User updated successfully", user: updated });
  } catch (err) {
    console.error("❌ Error updating user:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
});

// ✅ Remove penalty (clear skipUntil and lastAbsentReason)
router.put('/users/:id/remove-penalty', requireAuth, requireRole(['super_admin','admin','supervisor']), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.skipUntil = null;
    user.lastAbsentReason = '';
    await user.save();

    if (global.io) global.io.emit('userPenaltyCleared', { userId: user._id });

    res.json({ success: true, message: 'Penalty removed', user });
  } catch (err) {
    console.error('❌ Failed to remove penalty:', err);
    res.status(500).json({ message: 'Failed to remove penalty' });
  }
});

router.get("/pending-count", requireAuth, async (req, res) => {
  try {
    // Only admin and super_admin can see the actual count
    // Other authenticated users get 0 without error
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      const count = await User.countDocuments({
        $or: [{ status: "pending" }, { active: false }],
      });
      res.json({ pendingCount: count });
    } else {
      // Return 0 for non-admin users
      res.json({ pendingCount: 0 });
    }
  } catch (err) {
    console.error("❌ Error getting pending count:", err);
    res.status(500).json({ message: "Failed to fetch pending count" });
  }
});

/* ========================================================
   💼 PAYROLL SUMMARY (Admin Dashboard)
======================================================== */
router.get("/payroll-summary", async (req, res) => {
  try {
    const { filter, date } = req.query; // filter: 'daily', 'weekly', 'monthly', 'overall'
    let payrolls = await Payroll.find().lean();

    // Apply date filtering based on filter type
    if (filter && filter !== 'overall' && date) {
      const filterDate = new Date(date);
      
      if (filter === 'daily') {
        // Filter for specific day
        payrolls = payrolls.filter(p => {
          const pDate = new Date(p.createdAt || p.date);
          return pDate.getFullYear() === filterDate.getFullYear() &&
                 pDate.getMonth() === filterDate.getMonth() &&
                 pDate.getDate() === filterDate.getDate();
        });
      } else if (filter === 'weekly') {
        // Filter for week containing the date
        const dayOfWeek = filterDate.getDay();
        const monday = new Date(filterDate);
        monday.setDate(filterDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        monday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        payrolls = payrolls.filter(p => {
          const pDate = new Date(p.createdAt || p.date);
          return pDate >= monday && pDate <= sunday;
        });
      } else if (filter === 'monthly') {
        // Filter for specific month
        payrolls = payrolls.filter(p => {
          const pDate = new Date(p.createdAt || p.date);
          return pDate.getFullYear() === filterDate.getFullYear() &&
                 pDate.getMonth() === filterDate.getMonth();
        });
      }
    }

    const totalPayrolls = payrolls.length;
    const approvedCount = payrolls.filter((p) => p.approved).length;
    const pendingCount = payrolls.filter((p) => !p.approved).length;
    const totalPayout = payrolls
      .filter((p) => p.approved)
      .reduce((sum, p) => sum + (p.totalSalary || 0), 0);

    res.json({ totalPayrolls, approvedCount, pendingCount, totalPayout });
  } catch (err) {
    console.error("❌ Error fetching payroll summary:", err);
    res.status(500).json({ message: "Failed to fetch payroll summary" });
  }
});

/* ========================================================
   📊 DAILY FINANCIAL SUMMARY REPORT (SuperAdmin Only)
======================================================== */
router.get("/financial-summary/:date", requireAuth, async (req, res) => {
  try {
    const { date } = req.params; // Expected format: YYYY-MM-DD
    
    // Check if user is SuperAdmin
    const user = await User.findById(req.userId).lean();
    if (user?.role !== 'super_admin') {
      return res.status(403).json({ message: "Access denied. SuperAdmin required." });
    }

    // Parse the date to get start and end of day
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Fetch all payroll records for this date
    const payrolls = await Payroll.find({
      date: date,
      approved: true
    }).populate('user').lean();

    // Fetch cashflow transactions for this date
    const cashflows = await Cashflow.find({
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    // Fetch admin finance data for this date
    const adminFinance = await AdminFinance.findOne({
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    // Calculate salary data by role
    const expenseByRole = {};
    const roles = ["teller", "admin", "supervisor", "supervisor_teller", "head_watcher", "sub_watcher", "declarator"];
    
    roles.forEach(role => {
      const rolePayrolls = payrolls.filter(p => p.role === role);
      expenseByRole[role] = {
        count: rolePayrolls.length,
        totalSalary: rolePayrolls.reduce((sum, p) => sum + (p.totalSalary || 0), 0),
        totalOver: rolePayrolls.reduce((sum, p) => sum + (p.over || 0), 0),
      };
    });

    // Calculate totals
    const totalSalary = payrolls.reduce((sum, p) => sum + (p.totalSalary || 0), 0);
    const totalOver = payrolls.reduce((sum, p) => sum + (p.over || 0), 0);
    const totalExpense = payrolls.reduce((sum, p) => sum + (p.deduction || 0), 0);

    // Categorize expenses from cashflow
    const expenses = {
      pettyCash: 0,
      registration: 0,
      meals: 0,
      water: 0,
      thermal: 0,
      other: 0
    };

    cashflows.forEach(cf => {
      if (cf.type === 'expense') {
        const desc = cf.description.toLowerCase();
        if (desc.includes('petty')) expenses.pettyCash += cf.amount;
        else if (desc.includes('registration') || desc.includes('permit')) expenses.registration += cf.amount;
        else if (desc.includes('meal') || desc.includes('food')) expenses.meals += cf.amount;
        else if (desc.includes('water')) expenses.water += cf.amount;
        else if (desc.includes('thermal') || desc.includes('print')) expenses.thermal += cf.amount;
        else expenses.other += cf.amount;
      }
    });

    // Admin finance data
    const opCommission = adminFinance?.commission || 0;
    const adminExpense = adminFinance?.expenses || 0;
    const adminDraw = adminFinance?.draw || 0;

    // Calculate cash position (mock data - would need actual transaction logic)
    const revolvingMoney = 0; // Would need transaction data
    const systemBalance = 0; // Would need transaction data
    const cashOnHand = 0; // Would need transaction data
    const difference = 0; // Would need transaction data

    res.json({
      date,
      cashPosition: {
        revolvingMoney,
        systemBalance,
        cashOnHand,
        difference
      },
      salary: {
        totalSalary,
        totalOver,
        opCommission,
        adminExpense,
        adminDraw
      },
      expenseByRole,
      expenses,
      adminData: {
        commission: opCommission,
        draw: adminDraw,
        expenses: adminExpense
      },
      totals: {
        totalPayrollExpense: totalSalary + totalExpense,
        totalCashExpense: Object.values(expenses).reduce((a, b) => a + b, 0),
        grandTotal: totalSalary + totalExpense + Object.values(expenses).reduce((a, b) => a + b, 0)
      }
    });

  } catch (err) {
    console.error("❌ Error fetching financial summary:", err);
    res.status(500).json({ message: "Failed to fetch financial summary", error: err.message });
  }
});

/* ========================================================
   🔧 FIX BASE SALARIES FOR ALL USERS (EMERGENCY FIX)
======================================================== */
router.post("/fix-base-salaries", requirePermission('employees'), async (req, res) => {
  try {
    const defaultBaseSalaries = {
      teller: 450,
      supervisor: 600,
      supervisor_teller: 600,
      admin: 0,
      super_admin: 0,
      head_watcher: 450,
      sub_watcher: 400,
      declarator: 450,
    };

    console.log('🔧 Fixing base salaries for all users...');

    const users = await User.find({});
    let fixedCount = 0;

    for (const user of users) {
      const correctSalary = defaultBaseSalaries[user.role] || 450;
      if (!user.baseSalary || user.baseSalary === 0 || user.baseSalary !== correctSalary) {
        user.baseSalary = correctSalary;
        await user.save();
        fixedCount++;
      }
    }

    console.log(`✅ Fixed base salaries for ${fixedCount} users`);

    res.json({
      success: true,
      message: `Fixed base salaries for ${fixedCount} users`,
      fixedCount
    });

  } catch (err) {
    console.error("❌ Error fixing base salaries:", err);
    res.status(500).json({ error: "Failed to fix base salaries" });
  }
});

/* ========================================================
   🔑 CHANGE USER PASSWORD (ADMIN ONLY)
======================================================== */
router.put("/users/:id/password", requirePermission('employees'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters long" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    console.log(`✅ Password changed for user: ${user.name || user.username}`);

    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (err) {
    console.error("❌ Error changing password:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// Update user theme preferences
router.put("/users/:id/theme", requirePermission('employees'), async (req, res) => {
  try {
    const { id } = req.params;
    const { theme } = req.body;

    if (!theme) {
      return res.status(400).json({ error: "Theme data is required" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update theme preferences
    user.theme = {
      mode: theme.mode || user.theme?.mode || "light",
      lightFont: theme.lightFont || user.theme?.lightFont || "#1f2937",
      darkFont: theme.darkFont || user.theme?.darkFont || "#f9fafb",
      lightBg: theme.lightBg || user.theme?.lightBg || "#ffffff",
      darkBg: theme.darkBg || user.theme?.darkBg || "#1e3a8a",
    };

    await user.save();

    console.log(`✅ Theme updated for user: ${user.name || user.username}`);

    res.json({
      success: true,
      message: "Theme updated successfully",
      theme: user.theme
    });
  } catch (err) {
    console.error("❌ Error updating theme:", err);
    res.status(500).json({ error: "Failed to update theme" });
  }
});

/* ========================================================
   🔧 FIX BASE SALARIES FOR ALL USERS (TEMPORARY)
======================================================== */
router.post("/fix-base-salaries", requirePermission('employees'), async (req, res) => {
  try {
    const defaultBaseSalaries = {
      teller: 450,
      supervisor: 600,
      supervisor_teller: 600,
      admin: 0,
      super_admin: 0,
      head_watcher: 450,
      sub_watcher: 400,
      declarator: 450,
    };

    console.log('🔧 Fixing base salaries for all users...');

    const users = await User.find({});
    let fixedCount = 0;

    for (const user of users) {
      const correctSalary = defaultBaseSalaries[user.role] || 450;
      if (!user.baseSalary || user.baseSalary === 0 || user.baseSalary !== correctSalary) {
        user.baseSalary = correctSalary;
        await user.save();
        fixedCount++;
      }
    }

    console.log(`✅ Fixed base salaries for ${fixedCount} users`);

    res.json({
      success: true,
      message: `Fixed base salaries for ${fixedCount} users`,
      fixedCount
    });

  } catch (err) {
    console.error("❌ Error fixing base salaries:", err);
    res.status(500).json({ error: "Failed to fix base salaries" });
  }
});

/**
 * 🔧 UPDATE PAYROLL BASE SALARIES FOR EMPLOYEES WITH ₱0
 * POST /api/admin/fix-payroll-base-salaries
 * Body: { targetNames: [...], baseSalary: 450, conditionalSalaries: { apple: 600 }, reason: "..." }
 */
router.post('/fix-payroll-base-salaries', requirePermission('employees'), async (req, res) => {
  try {
    const { targetNames, baseSalary = 450, conditionalSalaries = {}, reason = '' } = req.body;
    const currentUser = req.user; // From auth middleware

    if (!targetNames || !Array.isArray(targetNames)) {
      return res.status(400).json({ error: "targetNames array is required" });
    }

    console.log(`🔧 Updating payroll base salaries for: ${targetNames.join(', ')}`);
    console.log(`   Performed by: ${currentUser?.name || currentUser?.email}`);
    console.log(`   Reason: ${reason || 'N/A'}`);

    // Build query for payroll records with baseSalary = 0 or null
    const query = {
      baseSalary: { $in: [0, null, undefined] },
      $or: targetNames.flatMap(name => [
        { 'user.name': { $regex: `^${name}$`, $options: 'i' } },
        { tellerName: { $regex: `^${name}$`, $options: 'i' } },
        { name: { $regex: `^${name}$`, $options: 'i' } }
      ])
    };

    // Use Mongoose model to query
    const payrolls = await Payroll.find(query).populate('user');
    console.log(`Found ${payrolls.length} payroll records to update`);

    if (payrolls.length === 0) {
      const auditLog = new PayrollAuditLog({
        actionType: 'BATCH_UPDATE',
        performedBy: {
          userId: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role
        },
        targetEmployees: targetNames.map(name => ({ employeeName: name, baseSalaryBefore: 0, baseSalaryAfter: 0, affectedRecords: 0 })),
        totalRecordsUpdated: 0,
        reason,
        status: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      await auditLog.save();

      return res.json({
        success: true,
        message: 'No payroll records found with ₱0 base salary for these employees',
        updated: 0,
        details: [],
        auditLogId: auditLog._id
      });
    }

    // Update payrolls
    const details = [];
    let updateErrors = [];

    for (const payroll of payrolls) {
      try {
        // Determine the salary for this employee
        let newBaseSalary = baseSalary;
        const employeeName = (payroll.user?.name || payroll.tellerName || payroll.name || '').toLowerCase();
        
        // Check if this employee has a conditional salary
        for (const [targetName, conditionalAmount] of Object.entries(conditionalSalaries)) {
          if (employeeName.includes(targetName.toLowerCase())) {
            newBaseSalary = conditionalAmount;
            break;
          }
        }

        const result = await Payroll.findByIdAndUpdate(
          payroll._id,
          { 
            $set: { 
              baseSalary: newBaseSalary,
              updatedAt: new Date()
            }
          },
          { new: true }
        );

        if (result) {
          const name = payroll.user?.name || payroll.tellerName || payroll.name || 'Unknown';
          details.push({
            employee: name,
            date: payroll.date,
            baseSalaryBefore: payroll.baseSalary || 0,
            baseSalaryAfter: newBaseSalary,
            updated: true
          });
        }
      } catch (err) {
        updateErrors.push({
          payrollId: payroll._id,
          error: err.message
        });
      }
    }

    // Also update user base salary
    console.log(`\nUpdating user records...`);
    let usersUpdated = 0;
    const userUpdates = [];

    for (const name of targetNames) {
      try {
        const user = await User.findOne({
          name: { $regex: name, $options: 'i' }
        });

        if (user) {
          // Determine salary for this user
          let newBaseSalary = baseSalary;
          
          for (const [targetName, conditionalAmount] of Object.entries(conditionalSalaries)) {
            if (user.name.toLowerCase().includes(targetName.toLowerCase())) {
              newBaseSalary = conditionalAmount;
              break;
            }
          }

          if (user.baseSalary !== newBaseSalary) {
            await User.findByIdAndUpdate(user._id, { baseSalary: newBaseSalary });
            usersUpdated++;
            userUpdates.push({
              employeeName: user.name,
              baseSalaryBefore: user.baseSalary || 0,
              baseSalaryAfter: newBaseSalary
            });
            console.log(`✅ Updated user: ${user.name} → ₱${newBaseSalary}`);
          }
        }
      } catch (err) {
        updateErrors.push({
          user: name,
          error: err.message
        });
      }
    }

    // Create audit log
    const auditLog = new PayrollAuditLog({
      actionType: 'BATCH_UPDATE',
      performedBy: {
        userId: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role
      },
      targetEmployees: details.map(d => ({
        employeeName: d.employee,
        baseSalaryBefore: d.baseSalaryBefore,
        baseSalaryAfter: d.baseSalaryAfter,
        affectedRecords: 1
      })),
      totalRecordsUpdated: details.length,
      payrollsUpdated: details.length,
      usersUpdated,
      changes: {
        baseSalary: baseSalary,
        conditionalSalaries,
        targetEmployees: targetNames
      },
      reason,
      status: updateErrors.length === 0 ? 'SUCCESS' : updateErrors.length === details.length ? 'FAILED' : 'PARTIAL',
      errorMessage: updateErrors.length > 0 ? JSON.stringify(updateErrors) : null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    await auditLog.save();

    console.log(`✅ Completed: ${details.length} payroll records + ${usersUpdated} users updated`);

    // Send email notification
    const notificationSent = await sendPayrollUpdateNotification({
      recipients: [
        process.env.ADMIN_EMAIL || currentUser.email,
        ...(process.env.NOTIFICATION_EMAILS ? process.env.NOTIFICATION_EMAILS.split(',') : [])
      ],
      employeeUpdates: [...details, ...userUpdates],
      totalRecords: details.length + usersUpdated,
      performedBy: currentUser.name || currentUser.email,
      reason
    });

    if (notificationSent) {
      await PayrollAuditLog.findByIdAndUpdate(auditLog._id, { notificationSent: true });
    }

    res.json({
      success: true,
      message: `Updated ${details.length} payroll records and ${usersUpdated} user records`,
      updated: details.length,
      usersUpdated,
      details,
      auditLogId: auditLog._id,
      notificationSent
    });

  } catch (err) {
    console.error("❌ Error updating payroll base salaries:", err);
    
    // Send error notification to admin
    await sendErrorNotification(
      process.env.ADMIN_EMAIL,
      err,
      { employees: req.body?.targetNames || [] }
    );

    res.status(500).json({ error: "Failed to update payroll base salaries", details: err.message });
  }
});

/**
 * 📋 GET PAYROLL AUDIT LOGS
 * GET /api/admin/payroll-audit-logs
 */
router.get('/payroll-audit-logs', requirePermission('employees'), async (req, res) => {
  try {
    const { limit = 10, sort = -1, actionType = null } = req.query;

    let query = {};
    if (actionType) {
      query.actionType = actionType;
    }

    const logs = await PayrollAuditLog.find(query)
      .sort({ createdAt: sort })
      .limit(parseInt(limit))
      .lean();

    res.json(logs);
  } catch (err) {
    console.error("❌ Error fetching audit logs:", err);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

/**
 * 🔍 GET EMPLOYEES WITH ZERO BASE SALARY
 * GET /api/admin/employees-with-zero-salary
 * Returns list of unique employees from payroll with baseSalary = 0 or null
 */
router.get('/employees-with-zero-salary', requirePermission('employees'), async (req, res) => {
  try {
    // Find payroll records with zero base salary
    const payrolls = await Payroll.find({ 
      baseSalary: { $in: [0, null, undefined] } 
    }).select('tellerName name user').populate('user', 'name role baseSalary');

    // Extract unique employees
    const employeeMap = new Map();
    
    for (const payroll of payrolls) {
      const empName = payroll.user?.name || payroll.tellerName || payroll.name || 'Unknown';
      const empRole = payroll.user?.role || 'teller';
      
      if (!employeeMap.has(empName)) {
        employeeMap.set(empName, {
          name: empName,
          role: empRole,
          baseSalary: payroll.user?.baseSalary || 0,
          recordCount: 1
        });
      } else {
        const existing = employeeMap.get(empName);
        existing.recordCount++;
      }
    }

    const employees = Array.from(employeeMap.values());

    res.json({
      success: true,
      count: employees.length,
      employees: employees.sort((a, b) => a.name.localeCompare(b.name))
    });

  } catch (err) {
    console.error("❌ Error fetching employees with zero salary:", err);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

/**
 * 🔧 FIX ALL HISTORICAL PAYROLL WITH ZERO BASE SALARY
 * POST /api/admin/fix-all-historical-payroll
 * Fixes ALL payroll records with baseSalary = 0 (not just specific employees)
 */
router.post('/fix-all-historical-payroll', requirePermission('employees'), async (req, res) => {
  try {
    const { reason = 'Batch fix for historical payroll records with zero base salary' } = req.body;
    const currentUser = req.user;

    console.log(`🔧 Fixing ALL historical payroll records with ₱0 base salary...`);
    console.log(`   Performed by: ${currentUser?.name || currentUser?.email}`);

    // Find ALL payroll records with zero base salary
    const payrolls = await Payroll.find({ 
      baseSalary: { $in: [0, null, undefined] } 
    }).populate('user');

    if (payrolls.length === 0) {
      return res.json({
        success: true,
        message: 'No payroll records with ₱0 base salary found',
        updated: 0,
        details: []
      });
    }

    console.log(`Found ${payrolls.length} payroll records to fix`);

    // Update all payroll records
    const details = [];
    let updateCount = 0;

    for (const payroll of payrolls) {
      try {
        // Determine correct salary based on user role
        let newBaseSalary = 450; // default for tellers
        
        if (payroll.user) {
          const role = payroll.user.role;
          if (role === 'supervisor' || role === 'supervisor_teller') {
            newBaseSalary = 600;
          } else if (role === 'admin' || role === 'super_admin') {
            newBaseSalary = 0;
          } else if (role === 'head_watcher') {
            newBaseSalary = 450;
          } else if (role === 'sub_watcher') {
            newBaseSalary = 400;
          } else if (role === 'declarator') {
            newBaseSalary = 450;
          }
        }

        // Update the payroll record
        const updated = await Payroll.findByIdAndUpdate(
          payroll._id,
          {
            $set: {
              baseSalary: newBaseSalary,
              updatedAt: new Date()
            }
          },
          { new: true }
        );

        if (updated) {
          const empName = payroll.user?.name || payroll.tellerName || payroll.name || 'Unknown';
          details.push({
            employee: empName,
            date: payroll.date,
            baseSalaryBefore: payroll.baseSalary || 0,
            baseSalaryAfter: newBaseSalary
          });
          updateCount++;
          
          if (updateCount % 100 === 0) {
            console.log(`   ✅ Updated ${updateCount} records...`);
          }
        }
      } catch (err) {
        console.error(`Error updating payroll ${payroll._id}:`, err.message);
      }
    }

    console.log(`✅ Completed: ${updateCount} payroll records updated`);

    // Create audit log
    const auditLog = new PayrollAuditLog({
      actionType: 'BATCH_UPDATE',
      performedBy: {
        userId: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role
      },
      targetEmployees: Array.from(new Set(details.map(d => d.employee))).map(name => ({
        employeeName: name,
        affectedRecords: details.filter(d => d.employee === name).length
      })),
      totalRecordsUpdated: updateCount,
      payrollsUpdated: updateCount,
      changes: {
        fixType: 'ALL_HISTORICAL',
        basedOnUserRole: true
      },
      reason,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    await auditLog.save();

    // Send email notification
    const notificationSent = await sendPayrollUpdateNotification({
      recipients: [
        process.env.ADMIN_EMAIL || currentUser.email,
        ...(process.env.NOTIFICATION_EMAILS ? process.env.NOTIFICATION_EMAILS.split(',') : [])
      ],
      employeeUpdates: details.slice(0, 20), // Send first 20 in email
      totalRecords: updateCount,
      performedBy: currentUser.name || currentUser.email,
      reason: `${reason} (Total: ${updateCount} records)`
    });

    res.json({
      success: true,
      message: `✅ Fixed ${updateCount} historical payroll records with base salaries based on employee roles`,
      updated: updateCount,
      details: details.slice(0, 50), // Return first 50 in response
      auditLogId: auditLog._id,
      notificationSent
    });

  } catch (err) {
    console.error("❌ Error fixing historical payroll:", err);
    
    await sendErrorNotification(
      process.env.ADMIN_EMAIL,
      err,
      { type: 'fix-all-historical-payroll' }
    );

    res.status(500).json({ error: "Failed to fix historical payroll records", details: err.message });
  }
});

/**
 * 🆕 POST /api/admin/restore-tellers
 * Restore tellers from provided list (admin only)
 */
router.post("/restore-tellers", requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { tellers } = req.body;
    
    if (!Array.isArray(tellers) || tellers.length === 0) {
      return res.status(400).json({ error: "Tellers array required" });
    }

    console.log(`🔄 Restoring ${tellers.length} tellers...`);

    // Clear existing tellers
    await User.deleteMany({ role: "teller" });
    console.log("✅ Cleared existing tellers");

    const hashedPassword = await bcrypt.hash("password123", 10);
    const now = new Date();

    const usersToInsert = tellers.map(t => ({
      name: typeof t === 'string' ? t : t.name || t.username,
      username: (typeof t === 'string' ? t.toLowerCase() : (t.username || t.name || t).toLowerCase()).replace(/\s+/g, ''),
      email: `${(typeof t === 'string' ? t.toLowerCase() : (t.username || t.name || t).toLowerCase()).replace(/\s+/g, '')}@rmi.com`,
      password: hashedPassword,
      role: "teller",
      status: "approved",
      totalWorkDays: 0,
      lastWorked: now,
      createdAt: now,
      updatedAt: now,
    }));

    const result = await User.insertMany(usersToInsert);
    console.log(`✅ Successfully restored ${result.length} tellers`);

    res.json({
      success: true,
      message: `Successfully restored ${result.length} tellers`,
      tellers: result.map(u => ({ _id: u._id, name: u.name, username: u.username, role: u.role, status: u.status }))
    });
  } catch (err) {
    console.error("❌ Failed to restore tellers:", err.message);
    res.status(500).json({ error: "Failed to restore tellers", details: err.message });
  }
});

/* ========================================================
   🆕 POST /api/admin/create-shane-marie-payroll
   Create Shane Marie Quijano with payroll records
======================================================== */
router.post("/create-shane-marie-payroll", requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log('\n📝 Creating Shane Marie Quijano with payroll records...\n');
    
    let shaneMarie = await User.findOne({ $or: [{ username: '017.marie' }, { name: /shane.*marie/i }] });
    
    if (!shaneMarie) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      shaneMarie = new User({
        name: 'Shane Marie Quijano',
        username: '017.marie',
        employeeId: '017.marie',
        email: '017.marie@rmi.com',
        password: hashedPassword,
        role: 'teller',
        status: 'approved',
        baseSalary: 450,
        totalWorkDays: 0,
        lastWorked: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await shaneMarie.save();
      console.log(`✅ Created user: ${shaneMarie.name}`);
    } else {
      console.log(`✅ Found existing user: ${shaneMarie.name}`);
    }
    
    // Delete existing payroll records
    await Payroll.deleteMany({ user: shaneMarie._id });
    console.log(`✅ Cleared existing payroll records\n`);
    
    // Create payroll records
    const payrollData = [
      { date: '2025-11-28', baseSalary: 450, over: 373, short: 0, description: '11/28/2025' },
      { date: '2025-11-29', baseSalary: 450, over: 174, short: 0, description: '11/29/2025' },
      { date: '2025-12-03', baseSalary: 450, over: 0, short: 0, description: '12/3/2025 (no report yet)' }
    ];
    
    const createdPayrolls = [];
    for (const data of payrollData) {
      const totalSalary = computeTotalSalary({
        baseSalary: data.baseSalary,
        over: data.over,
        short: data.short,
        deduction: 0,
        withdrawal: 0,
        shortIsInstallment: true
      }, { period: 'daily' });
      
      const payroll = new Payroll({
        user: shaneMarie._id,
        role: shaneMarie.role,
        baseSalary: data.baseSalary,
        over: data.over,
        short: data.short,
        daysPresent: 1,
        totalSalary: totalSalary,
        deduction: 0,
        withdrawal: 0,
        date: new Date(data.date),
        approved: false,
        locked: false,
        note: data.description,
        withdrawn: false,
        adjustments: []
      });
      
      await payroll.save();
      createdPayrolls.push(payroll);
      console.log(`✅ ${data.description}: ₱${totalSalary}`);
    }
    
    res.json({
      success: true,
      message: 'Shane Marie Quijano created with payroll records',
      user: shaneMarie,
      payrollRecords: createdPayrolls
    });
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create Shane Marie payroll', error: err.message });
  }
});

export default router;
