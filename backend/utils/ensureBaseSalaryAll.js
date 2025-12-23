import User from "../models/User.js";
import Payroll from "../models/Payroll.js";
import Transaction from "../models/Transaction.js";
import { DateTime } from "luxon";

/**
 * ✅ Ensure ALL users who ever added capital have base salary payroll for this month
 * This is a one-time backfill utility
 */
export async function ensureBaseSalaryForAllCapitalUsers() {
  try {
    const now = DateTime.now().setZone("Asia/Manila");
    const monthStart = new Date(now.year, now.month - 1, 1);
    const monthEnd = new Date(now.year, now.month, 0, 23, 59, 59);

    console.log(`🔍 Checking all capital transactions to ensure base salary payroll...`);

    // Find ALL capital transactions ever
    const capitalTxns = await Transaction.find({ type: "capital" }).lean();

    const activeUserIds = new Set();

    // Collect teller IDs
    capitalTxns.forEach(tx => {
      if (tx.tellerId) activeUserIds.add(String(tx.tellerId));
    });

    // Collect supervisor IDs
    capitalTxns.forEach(tx => {
      if (tx.supervisorId) activeUserIds.add(String(tx.supervisorId));
    });

    if (activeUserIds.size === 0) {
      console.log("⚠️ No capital transactions found in database.");
      return { created: 0, existing: 0, total: 0 };
    }

    console.log(`✅ Found ${activeUserIds.size} unique users with capital activity.`);

    let created = 0;
    let existing = 0;

    // For each user, ensure payroll exists for this month
    for (const uid of activeUserIds) {
      const u = await User.findById(uid).lean();
      if (!u) {
        console.warn(`⚠️ User ${uid} not found in database, skipping.`);
        continue;
      }

      // Check if payroll already exists for this month
      const existingPayroll = await Payroll.findOne({
        user: uid,
        createdAt: { $gte: monthStart, $lte: monthEnd },
      }).lean();

      if (existingPayroll) {
        console.log(`✅ Payroll already exists for ${u.name || u.username} (${u.role}) this month.`);
        existing++;
        continue;
      }

      // Create base salary payroll
      const baseSalary = u.baseSalary || 0;
      let totalSalary = baseSalary;

      const payrollData = {
        user: uid,
        role: u.role,
        baseSalary,
        over: 0,
        short: 0,
        deduction: 0,
        withdrawal: 0,
        totalSalary,
        createdAt: new Date(), // Explicitly set to now
      };

      const newPayroll = await Payroll.create(payrollData);
      console.log(`✅ Created base salary payroll for ${u.name || u.username} (${u.role}): ₱${baseSalary}`);
      created++;

      // Emit socket event if global io available
      if (global.io) {
        global.io.emit("payrollUpdated", { userId: uid, payrollId: newPayroll._id });
      }
    }

    console.log(`✅ Base salary backfill complete: ${created} created, ${existing} already existed.`);
    return { created, existing, total: activeUserIds.size };
  } catch (err) {
    console.error("❌ Error in ensureBaseSalaryForAllCapitalUsers:", err);
    throw err;
  }
}
