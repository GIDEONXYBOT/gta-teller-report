import User from "../models/User.js";
import Payroll from "../models/Payroll.js";
import Transaction from "../models/Transaction.js";
import SystemSettings from "../models/SystemSettings.js";
import { DateTime } from "luxon";

/**
 * ✅ Ensure base salary payroll exists for users who had supervisor-added capital yesterday.
 * This runs daily (from the system daily reset) and creates a payroll record for the day if missing.
 */
export async function ensureBaseSalaryForActiveUsers() {
  try {
    const now = DateTime.now().setZone("Asia/Manila");
    const yesterdayDt = now.minus({ days: 1 }).startOf("day");
    const dayStart = yesterdayDt.toJSDate();
    const dayEnd = yesterdayDt.endOf("day").toJSDate();
    const dayKey = yesterdayDt.toFormat("yyyy-MM-dd");

    // Find all capital transactions that were added by supervisors yesterday
    const capitalTxns = await Transaction.find({
      type: { $in: ["capital", "additional"] },
      createdAt: { $gte: dayStart, $lt: dayEnd },
      supervisorId: { $exists: true, $ne: null },
    }).lean();

    const activeUserIds = new Set();

    // Collect teller IDs from those capital transactions
    capitalTxns.forEach((tx) => {
      if (tx.tellerId) activeUserIds.add(String(tx.tellerId));
    });

    if (activeUserIds.size === 0) {
      console.log("✅ No supervisor-added capital yesterday; no daily base payrolls to create.");
      return;
    }

    console.log(
      `✅ Found ${activeUserIds.size} unique tellers with supervisor-added capital on ${dayKey}.`
    );

    // Also create payrolls for all supervisors daily
    const supervisors = await User.find({ role: 'supervisor', status: 'approved' }).lean();
    supervisors.forEach(sup => activeUserIds.add(String(sup._id)));

    console.log(`✅ Including ${supervisors.length} supervisors for daily base payroll creation.`);

    for (const uid of activeUserIds) {
      const u = await User.findById(uid).lean();
      if (!u) continue;

      // Include supervisors in payroll creation
      // if (u.role === 'supervisor') {
      //   console.log(`⏭️ Skipping supervisor ${u.name || u.username} - supervisors get payrolls through other means`);
      //   continue;
      // }
      
      // Get system settings for default base salaries
      const settings = await SystemSettings.findOne().lean();
      const tellerBase = settings?.baseSalary?.teller || 450;
      const supervisorBase = settings?.baseSalary?.supervisor || 600;
      
      // Determine target base salary based on role
      let targetBaseSalary = tellerBase;
      if (u.role === 'supervisor') {
        targetBaseSalary = supervisorBase;
      } else if (u.role === 'supervisor_teller') {
        // supervisor_teller gets teller base when working as teller
        targetBaseSalary = tellerBase;
      }
      
      // If user doesn't have baseSalary set, set it based on their role
      if (!u.baseSalary || Number(u.baseSalary) <= 0) {
        await User.findByIdAndUpdate(uid, { $set: { baseSalary: targetBaseSalary } });
        // refresh user object to reflect update
        u.baseSalary = targetBaseSalary;
        console.log(`🔧 Set baseSalary=${targetBaseSalary} for ${u.name || u.username} (${u.role})`);
      }

      // Check if payroll already exists for that exact day
      const existing = await Payroll.findOne({
        user: uid,
        $or: [
          { date: dayKey },
          { createdAt: { $gte: dayStart, $lt: dayEnd } },
        ],
      }).lean();

      const baseSalary = Number(u.baseSalary || 0);

      if (existing) {
        // If payroll exists but has baseSalary = 0 and user now has baseSalary, update it
        if ((!existing.baseSalary || Number(existing.baseSalary) === 0) && baseSalary > 0) {
          const updatedTotal = baseSalary + Number(existing.over || 0) - Number(existing.short || 0) - Number(existing.deduction || 0);
          await Payroll.findByIdAndUpdate(existing._id, {
            $set: { baseSalary, totalSalary: updatedTotal }
          });
          console.log(
            `🔧 Updated existing payroll for ${u.name || u.username} on ${dayKey}: base=₱${baseSalary}, total=₱${updatedTotal}`
          );
          if (global.io) {
            global.io.emit("payrollUpdated", { userId: uid, payrollId: existing._id });
          }
        } else {
          console.log(`ℹ️ Payroll already exists for ${u.name || u.username} on ${dayKey} with baseSalary=${existing.baseSalary}`);
        }
        continue;
      }

      // Create new payroll
      const payrollData = {
        user: uid,
        role: u.role || "teller",
        baseSalary,
        over: 0,
        short: 0,
        deduction: 0,
        withdrawal: 0,
        totalSalary: baseSalary,
        date: dayKey,
        createdAt: dayStart,
      };

      // Validate required fields before creating
      if (!payrollData.user || !payrollData.role) {
        console.error(`❌ Cannot create payroll: missing user or role for ${u.name || u.username} (uid: ${uid}, role: ${u.role})`);
        continue;
      }

      const newPayroll = await Payroll.create(payrollData);
      console.log(
        `✅ Created daily base payroll for ${u.name || u.username} on ${dayKey}: base=₱${baseSalary}`
      );

      if (global.io) {
        global.io.emit("payrollUpdated", { userId: uid, payrollId: newPayroll._id });
      }
    }

    console.log("✅ Daily base payroll creation complete.");
  } catch (err) {
    console.error("❌ Error in ensureBaseSalaryForActiveUsers:", err);
  }
}
