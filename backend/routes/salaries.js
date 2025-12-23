import express from "express";
import User from "../models/User.js";
import Payroll from "../models/Payroll.js";
import Withdrawal from "../models/Withdrawal.js";

const router = express.Router();

/**
 * GET /api/salaries
 * Returns a summary list of salaries and withdrawals for tellers/supervisor_teller
 */
router.get("/", async (req, res) => {
  try {
    // Query tellers and supervisor_teller roles
    const users = await User.find({ role: { $in: ["teller", "supervisor_teller"] } }).select("_id username name baseSalary").lean();

    const results = await Promise.all(users.map(async (u) => {
      const payrolls = await Payroll.find({ user: u._id }).sort({ createdAt: -1 }).lean();
      const withdrawals = await Withdrawal.find({ userId: u._id }).sort({ createdAt: -1 }).lean();

      const totalSalary = payrolls.reduce((s, p) => s + (Number(p.totalSalary || 0)), 0);
      const over = payrolls.reduce((s, p) => s + (Number(p.over || 0)), 0);
      const short = payrolls.reduce((s, p) => s + (Number(p.short || 0)), 0);

      return {
        user: u.username,
        name: u.name || u.username,
        userId: u._id,
        baseSalary: u.baseSalary || (payrolls[0] && payrolls[0].baseSalary) || 0,
        daysWorked: payrolls.length,
        totalSalary,
        over,
        short,
        withdrawRequests: withdrawals.map(w => ({ amount: w.amount, status: w.status, requestedAt: w.createdAt, respondedAt: w.approvedAt || null }))
      };
    }));

    res.json(results);
  } catch (err) {
    console.error("❌ GET /api/salaries failed:", err);
    res.status(500).json({ success: false, message: "Failed to load salaries" });
  }
});

/**
 * POST /api/salaries/withdraw
 * { user: <username>, amount: Number }
 * Create a Withdrawal request for the user's unwithdrawn payrolls
 */
router.post("/withdraw", async (req, res) => {
  try {
    const { user: username, amount } = req.body;
    if (!username || !amount) return res.status(400).json({ success: false, message: "Missing user or amount" });

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Find payrolls for the user that are not yet withdrawn
    const payrolls = await Payroll.find({ user: user._id, withdrawn: false }).sort({ createdAt: 1 }).lean();
    const payrollIds = payrolls.map(p => p._id);

    // Create a withdrawal request (we don't automatically mark payrolls withdrawn)
    const withdrawal = new Withdrawal({
      userId: user._id,
      payrollIds,
      amount: Number(amount),
      remaining: 0,
      status: 'pending',
      createdBy: user._id
    });

    await withdrawal.save();

    res.json({ success: true, message: "Withdrawal request created", withdrawal });
  } catch (err) {
    console.error("❌ POST /api/salaries/withdraw failed:", err);
    res.status(500).json({ success: false, message: "Failed to create withdrawal" });
  }
});

export default router;
