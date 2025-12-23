import express from "express";
const router = express.Router();

router.get("/admin", async (req, res) => {
  try {
    const TellerReport = (await import("../models/TellerReport.js")).default;
    const Cashflow = (await import("../models/Cashflow.js")).default;
    const AdminPayroll = (await import("../models/AdminPayroll.js")).default;

    const totalReports = await TellerReport.countDocuments();
    const verifiedReports = await TellerReport.countDocuments({ verified: true });
    const pendingReports = totalReports - verifiedReports;

    const expenses = await Cashflow.find();
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const payrolls = await AdminPayroll.find();
    const totalPayroll = payrolls.reduce((s, p) => s + (p.salary || 0) + (p.over || 0), 0);

    res.json({
      totalReports,
      verifiedReports,
      pendingReports,
      totalExpenses,
      totalPayroll,
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error("❌ Error generating dashboard data:", err);
    res.status(500).json({ message: "Failed to load admin dashboard" });
  }
});

export default router;
