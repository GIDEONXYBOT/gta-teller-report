// backend/scheduler/midnightReset.js
import schedule from "node-schedule";
import DailyTellerAssignment from "../models/DailyTellerAssignment.js";
import TellerReport from "../models/TellerReport.js";
import Payroll from "../models/Payroll.js";
import AuditLog from "../models/AuditLog.js";
import Capital from "../models/Capital.js";
import User from "../models/User.js";
import SupervisorReport from "../models/SupervisorReport.js";
import TellerManagementModel from "../models/TellerManagementModel.js";
import { DateTime } from "luxon";
import { ensureBaseSalaryForActiveUsers } from "../utils/ensureBaseSalary.js";

let currentJob = null;

/**
 * Auto-assign tellers to supervisors based on capital additions
 * This runs daily to assign tellers to the supervisors who added capital for them
 */
async function autoAssignTellersToSupervisors() {
  try {
    const now = DateTime.now().setZone("Asia/Manila");
    const today = now.toFormat("yyyy-MM-dd");
    const yesterday = now.minus({ days: 1 }).toFormat("yyyy-MM-dd");
    
    console.log(`🔄 Auto-assigning tellers to supervisors for ${today}`);
    
    // Find all capital records created yesterday (when supervisors added capital)
    const capitalRecords = await Capital.find({
      createdAt: {
        $gte: new Date(yesterday + 'T00:00:00.000Z'),
        $lt: new Date(today + 'T00:00:00.000Z')
      }
    }).populate('tellerId supervisorId');
    
    console.log(`💰 Found ${capitalRecords.length} capital records from ${yesterday}`);
    
    if (capitalRecords.length === 0) {
      console.log("⚠️ No capital records found, skipping auto-assignment");
      return;
    }
    
    // Group capital records by supervisorId to see which supervisors added capital
    const supervisorTellerMap = new Map();
    
    for (const capital of capitalRecords) {
      if (capital.supervisorId && capital.tellerId) {
        const supervisorId = capital.supervisorId._id.toString();
        const tellerId = capital.tellerId._id.toString();
        
        if (!supervisorTellerMap.has(supervisorId)) {
          supervisorTellerMap.set(supervisorId, new Set());
        }
        supervisorTellerMap.get(supervisorId).add(tellerId);
      }
    }
    
    console.log(`👨‍💼 Found ${supervisorTellerMap.size} supervisors who added capital`);
    
    // Create daily assignments for today based on capital additions
    const assignments = [];
    let totalAssignments = 0;
    
    for (const [supervisorId, tellerIds] of supervisorTellerMap) {
      const supervisor = await User.findById(supervisorId).select('name username');
      const tellers = await User.find({ 
        _id: { $in: Array.from(tellerIds) },
        role: 'teller',
        status: 'approved'
      }).select('name username');
      
      console.log(`📋 Supervisor ${supervisor?.name} gets ${tellers.length} tellers assigned`);
      
      for (const teller of tellers) {
        // Check if assignment already exists for today
        const existingAssignment = await DailyTellerAssignment.findOne({
          dayKey: today,
          tellerId: teller._id,
          supervisorId: supervisorId
        });
        
        if (!existingAssignment) {
          assignments.push({
            dayKey: today,
            tellerId: teller._id,
            supervisorId: supervisorId,
            status: 'scheduled',
            assignedBy: 'system-auto',
            assignedAt: new Date(),
            completed: false
          });
          totalAssignments++;
          
          console.log(`  ✅ ${teller.name} → ${supervisor.name}`);
        } else {
          console.log(`  ⚠️ ${teller.name} already assigned to ${supervisor.name}`);
        }
      }
    }
    
    // Bulk insert new assignments
    if (assignments.length > 0) {
      await DailyTellerAssignment.insertMany(assignments);
      console.log(`✅ Auto-assigned ${totalAssignments} teller-supervisor relationships`);
      
      // Log the auto-assignment event
      await AuditLog.create({
        action: "system_auto_assignment",
        targetModel: "DailyTellerAssignment",
        details: `Auto-assigned ${totalAssignments} tellers to supervisors based on capital additions`,
        performedBy: "system",
        timestamp: new Date(),
        metadata: {
          date: today,
          assignmentsCreated: totalAssignments,
          supervisorsCount: supervisorTellerMap.size
        }
      });
    } else {
      console.log("📝 No new assignments needed - all tellers already assigned");
    }
    
  } catch (error) {
    console.error("❌ Error in auto-assignment:", error);
    
    // Log the error
    await AuditLog.create({
      action: "system_error",
      targetModel: "DailyTellerAssignment",
      details: `Auto-assignment failed: ${error.message}`,
      performedBy: "system",
      timestamp: new Date(),
      metadata: { error: error.message }
    });
  }
}

/**
 * The actual reset logic (keeps previous behavior).
 */
export async function midnightReset() {
  try {
    const now = DateTime.now().setZone("Asia/Manila");
    const today = now.toFormat("yyyy-MM-dd");
    const yesterday = now.minus({ days: 1 }).toFormat("yyyy-MM-dd");

    console.log(`🌅 Daily Reset Started — ${today} (running at configured reset time)`);

    // 1) Finalize any open Teller Reports from yesterday
    const openReports = await TellerReport.find({ date: yesterday, closed: false });
    for (const r of openReports) {
      r.closed = true;
      r.closingTime = new Date();
      await r.save();
    }

    // 2) 🔄 PERSIST: Don't mark assignments as completed so they stay visible in schedule
    // Previously this marked yesterday's assignments as completed, causing them to disappear
    // Now we keep them as scheduled/active so supervisors can reference them
    // await DailyTellerAssignment.updateMany(
    //   { dayKey: yesterday },
    //   { $set: { completed: true } }
    // );

    // 3) Reset supervisor reports (clear submitted status for new day)
    const resetCount = await SupervisorReport.updateMany(
      { dateKey: yesterday, submitted: true },
      { $set: { submitted: false, submittedAt: null } }
    );
    if (resetCount.modifiedCount > 0) {
      console.log(`🔄 Reset ${resetCount.modifiedCount} supervisor reports for new day`);
    }

    // 3.5) Archive yesterday's teller management records WITHOUT creating carry-overs
    //     We want each new day to start with a clean slate; records only appear once
    //     capital is provided again. This prevents supervisors from seeing stale tellers.
    const yesterdayRecords = await TellerManagementModel.find({
      dateKey: yesterday,
      status: "active",
    });
    if (yesterdayRecords.length > 0) {
      console.log(
        `📦 Archiving ${yesterdayRecords.length} teller management records from ${yesterday}`
      );
      await TellerManagementModel.updateMany(
        { dateKey: yesterday, status: "active" },
        { $set: { status: "archived" } }
      );
    }

    // 3.6) Mark any still-active capital sessions as completed so a fresh capital must
    //      be provided to re-activate a teller for the new day.
    const completedCaps = await Capital.updateMany(
      { status: "active" },
      { $set: { status: "completed" } }
    );
    if (completedCaps.modifiedCount > 0) {
      console.log(
        `🧼 Completed ${completedCaps.modifiedCount} lingering active capital records to start ${today} clean`
      );
    }

    // 4) Log the reset event
    await AuditLog.create({
      actorName: "system",
      actionType: "daily_reset",
      data: { date: today, auto: true },
    });

    // 5) ✅ Auto-create base salary payroll for users with capital activity since yesterday
    await ensureBaseSalaryForActiveUsers();

    // 6) ✅ Auto-assign tellers to supervisors based on capital additions
    await autoAssignTellersToSupervisors();

    // 8) Emit real-time update to all connected clients
    if (global.io) {
      global.io.emit("systemReset", { message: "New day initialized", date: today });
      console.log("📡 Emitted 'systemReset' to all clients");
    }

    console.log(`✅ Daily Reset Completed — ${today}`);
  } catch (err) {
    console.error("❌ Daily reset failed:", err);
  }
}

/**
 * Schedule the daily reset for a specific time (Asia/Manila).
 * @param {string} timeStr - "HH:MM" (24-hour)
 */
export function scheduleDailyReset(timeStr = "04:00") {
  const parts = String(timeStr).split(":").map((n) => parseInt(n, 10));
  const hour = Number.isFinite(parts[0]) ? parts[0] : 0;
  const minute = Number.isFinite(parts[1]) ? parts[1] : 0;

  // cancel previous job if exists
  if (currentJob) {
    try {
      currentJob.cancel();
      console.log("🕓 Previous reset job cancelled");
    } catch (e) {
      console.warn("⚠️ Failed to cancel previous job:", e);
    }
  }

  // schedule new job using cron-style expression for better timezone support
  // "minute hour * * *" - runs every day at the specified hour and minute
  const cronExpression = `${minute} ${hour} * * *`;

  currentJob = schedule.scheduleJob(cronExpression, midnightReset);

  console.log(
    `🕐 Reset scheduled for ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} (cron: ${cronExpression})`
  );
}

/**
 * Optional getter if needed by routes (returns currently scheduled HH:MM string)
 */
export function getScheduledTime() {
  if (!currentJob) return null;

  try {
    // Try to get next invocation if available
    if (typeof currentJob.nextInvocation === 'function') {
      const next = currentJob.nextInvocation();
      if (next) {
        const dt = DateTime.fromJSDate(next).setZone("Asia/Manila");
        return dt.toFormat("HH:mm");
      }
    }

    // Fallback: try to get the scheduled time from the job object
    if (currentJob.nextInvocation && typeof currentJob.nextInvocation === 'function') {
      const next = currentJob.nextInvocation();
      if (next) {
        const dt = DateTime.fromJSDate(next).setZone("Asia/Manila");
        return dt.toFormat("HH:mm");
      }
    }

    // If we can't get the next invocation, return the configured time
    // This is a fallback since we know the job was scheduled with a specific time
    return "04:00"; // Default fallback
  } catch (error) {
    console.warn("⚠️ Error getting scheduled time:", error.message);
    return "04:00";
  }
}
