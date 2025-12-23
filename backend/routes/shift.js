import express from "express";
import Shift from "../models/Shift.js";
import User from "../models/User.js";
import Payroll from "../models/Payroll.js";
import SystemSettings from "../models/SystemSettings.js";

const router = express.Router();

/* ========================================================
   📅 GET today's shift for a user
======================================================== */
router.get("/today/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const shift = await Shift.findOne({ userId, date: today });
    
    res.json({ success: true, shift });
  } catch (err) {
    console.error("Error fetching today's shift:", err);
    res.status(500).json({ message: "Failed to fetch shift" });
  }
});

/* ========================================================
   🔄 SET/UPDATE shift for a user
======================================================== */
router.post("/set", async (req, res) => {
  try {
    const { userId, roleWorkedAs, date } = req.body;

    if (!userId || !roleWorkedAs || !date) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get system settings for base salaries
    const settings = await SystemSettings.findOne();
    const baseSalaries = {
      teller: settings?.baseSalaries?.teller || settings?.baseSalary?.teller || 450,
      supervisor: settings?.baseSalaries?.supervisor || settings?.baseSalary?.supervisor || 600,
      supervisor_teller: settings?.baseSalaries?.supervisor_teller || settings?.baseSalary?.supervisor || 600,
      admin: settings?.baseSalaries?.admin || settings?.baseSalary?.admin || 0,
      head_watcher: settings?.baseSalaries?.head_watcher || settings?.baseSalary?.head_watcher || 450,
      sub_watcher: settings?.baseSalaries?.sub_watcher || settings?.baseSalary?.sub_watcher || 400,
    };

    const baseSalaryUsed = user.baseSalary || baseSalaries[roleWorkedAs] || 450;

    // Create or update shift
    const shift = await Shift.findOneAndUpdate(
      { userId, date },
      {
        userId,
        assignedRole: user.role,
        roleWorkedAs,
        date,
        baseSalaryUsed,
      },
      { upsert: true, new: true }
    );

    // Update or create payroll for this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    let payroll = await Payroll.findOne({
      user: userId,
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    if (payroll) {
      // Update existing payroll
      const oldTotalSalary = payroll.totalSalary;
      payroll.baseSalary = baseSalaryUsed;
      payroll.role = roleWorkedAs;
      // Calculate total salary: base - deduction - withdrawal
      // Short/Over amounts are tracked separately for financial reporting only
      payroll.totalSalary = baseSalaryUsed - (payroll.deduction || 0) - (payroll.withdrawal || 0);
      
      // Add adjustments
      if (payroll.adjustments && payroll.adjustments.length > 0) {
        const adjustmentTotal = payroll.adjustments.reduce((sum, adj) => sum + adj.delta, 0);
        payroll.totalSalary += adjustmentTotal;
      }
      
      await payroll.save();
      console.log(`✅ Updated payroll for ${user.name}: ₱${oldTotalSalary} → ₱${payroll.totalSalary}`);
    } else {
      // Create new payroll
      payroll = new Payroll({
        user: userId,
        role: roleWorkedAs,
        baseSalary: baseSalaryUsed,
        totalSalary: baseSalaryUsed,
        daysPresent: 1,
        approved: false,
        locked: false,
        createdAt: startOfDay
      });
      await payroll.save();
      console.log(`✅ Created payroll for ${user.name} with base salary: ₱${baseSalaryUsed}`);
    }

    res.json({ success: true, shift, payroll });
  } catch (err) {
    console.error("Error setting shift:", err);
    
    if (err.code === 11000) {
      // Duplicate key error - shift already exists, try to update
      try {
        const shift = await Shift.findOneAndUpdate(
          { userId: req.body.userId, date: req.body.date },
          req.body,
          { new: true }
        );
        return res.json({ success: true, shift });
      } catch (updateErr) {
        console.error("Error updating shift:", updateErr);
        return res.status(500).json({ message: "Failed to update shift" });
      }
    }
    
    res.status(500).json({ message: "Failed to set shift" });
  }
});

/* ========================================================
   📊 GET shift history for a user
======================================================== */
router.get("/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 30 } = req.query;

    const shifts = await Shift.find({ userId })
      .sort({ date: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, shifts });
  } catch (err) {
    console.error("Error fetching shift history:", err);
    res.status(500).json({ message: "Failed to fetch shift history" });
  }
});

export default router;
