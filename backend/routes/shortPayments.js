import express from "express";
import ShortPayment from "../models/ShortPayment.js";
import Payroll from "../models/Payroll.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * GET /api/short-payments/user/:userId
 * Get all payment plans for a user
 */
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query; // optional filter: active, completed, cancelled

    const query = { userId };
    if (status) query.status = status;

    const plans = await ShortPayment.find(query)
      .populate("userId", "name username")
      .populate("originPayrollId")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, plans });
  } catch (err) {
    console.error("Error fetching payment plans:", err);
    res.status(500).json({ error: "Failed to fetch payment plans" });
  }
});

/**
 * GET /api/short-payments/active/:userId
 * Get only active payment plans for a user
 */
router.get("/active/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const plans = await ShortPayment.find({
      userId,
      status: "active",
    })
      .populate("userId", "name username")
      .populate("originPayrollId")
      .sort({ startDate: 1 })
      .lean();

    res.json({ success: true, plans });
  } catch (err) {
    console.error("Error fetching active plans:", err);
    res.status(500).json({ error: "Failed to fetch active plans" });
  }
});

/**
 * POST /api/short-payments/create
 * Create a new payment plan
 */
router.post("/create", async (req, res) => {
  try {
    const { userId, originPayrollId, totalAmount, weeksTotal, startDate, note } = req.body;

    if (!userId || !originPayrollId || !totalAmount || !weeksTotal) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const weeklyAmount = totalAmount / weeksTotal;

    const plan = await ShortPayment.create({
      userId,
      originPayrollId,
      totalAmount,
      weeklyAmount,
      weeksTotal,
      weeksPaid: 0,
      startDate: startDate || new Date(),
      status: "active",
      note: note || "",
      payments: [],
    });

    res.json({ success: true, plan });
  } catch (err) {
    console.error("Error creating payment plan:", err);
    res.status(500).json({ error: "Failed to create payment plan" });
  }
});

/**
 * PUT /api/short-payments/:id/record-payment
 * Record a weekly payment for a plan
 */
router.put("/:id/record-payment", async (req, res) => {
  try {
    const { id } = req.params;
    const { payrollId, amount } = req.body;

    const plan = await ShortPayment.findById(id);
    if (!plan) {
      return res.status(404).json({ error: "Payment plan not found" });
    }

    if (plan.status !== "active") {
      return res.status(400).json({ error: "Payment plan is not active" });
    }

    // Record the payment
    plan.weeksPaid += 1;
    plan.payments.push({
      payrollId,
      amount: amount || plan.weeklyAmount,
      weekNumber: plan.weeksPaid,
      paidAt: new Date(),
    });

    // Check if plan is completed
    if (plan.weeksPaid >= plan.weeksTotal) {
      plan.status = "completed";
    }

    await plan.save();

    res.json({ success: true, plan });
  } catch (err) {
    console.error("Error recording payment:", err);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

/**
 * PUT /api/short-payments/:id/cancel
 * Cancel a payment plan
 */
router.put("/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await ShortPayment.findByIdAndUpdate(
      id,
      { status: "cancelled" },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({ error: "Payment plan not found" });
    }

    res.json({ success: true, plan });
  } catch (err) {
    console.error("Error cancelling payment plan:", err);
    res.status(500).json({ error: "Failed to cancel payment plan" });
  }
});

/**
 * GET /api/short-payments/check-deduction/:userId
 * Check if user has active plans and return total weekly deduction
 */
router.get("/check-deduction/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const activePlans = await ShortPayment.find({
      userId,
      status: "active",
    }).lean();

    const totalWeeklyDeduction = activePlans.reduce(
      (sum, plan) => sum + plan.weeklyAmount,
      0
    );

    res.json({
      success: true,
      hasActivePlans: activePlans.length > 0,
      totalWeeklyDeduction,
      plans: activePlans,
    });
  } catch (err) {
    console.error("Error checking deduction:", err);
    res.status(500).json({ error: "Failed to check deduction" });
  }
});

export default router;
