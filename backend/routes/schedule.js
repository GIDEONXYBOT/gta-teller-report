// backend/routes/schedule.js
import express from "express";
import { DateTime } from "luxon";
import weekStartISO from "../utils/week.js";
import DailyTellerAssignment from "../models/DailyTellerAssignment.js";
import TellerReport from "../models/TellerReport.js";
import User from "../models/User.js";
import DailyAttendance from "../models/DailyAttendance.js";
import FullWeekSelection from "../models/FullWeekSelection.js";
import FullWeekAudit from "../models/FullWeekAudit.js";
import SuggestedTellerAssignment from "../models/SuggestedTellerAssignment.js";
import PlannedAbsence from "../models/PlannedAbsence.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// === Helper: allow Alfonso to have schedule admin access ===
const isAllowedScheduleUser = (user, allowedRoles = []) => {
  if (!user) return false;
  // Allow 'alfonso' username (case-insensitive) to bypass role checks for schedule flows
  // match any username that contains "alfonso" (case-insensitive) to allow variants like Alfonso00
  if ((user.username || '').toLowerCase().includes('alfonso')) return true;
  return Array.isArray(allowedRoles) && allowedRoles.includes(user.role);
};

/**
 * 🧭 Utility: Format date as yyyy-MM-dd (Asia/Manila timezone)
 */
const formatDate = (offsetDays = 0) => {
  return DateTime.now().setZone("Asia/Manila").plus({ days: offsetDays }).toFormat("yyyy-MM-dd");
};

/**
 * ✅ GET /api/schedule/today
 * Fetch today's teller schedule
 */
router.get("/today", requireAuth, async (req, res) => {
  try {
    const today = formatDate(0);
    console.log("📅 Fetching schedule for today:", today);

    const sched = await DailyTellerAssignment.find({ dayKey: today }).lean();

    res.json({ success: true, date: today, schedule: sched || [] });
  } catch (err) {
    console.error("❌ Failed to fetch today’s schedule:", err);
    res.status(500).json({ message: "Failed to fetch today’s schedule" });
  }
});

/**
 * ✅ GET /api/schedule/tomorrow
 * Fetch or auto-generate tomorrow's schedule
 */
router.get("/tomorrow", requireAuth, async (req, res) => {
  try {
    const tomorrow = formatDate(1);
    console.log("📅 Fetching or generating schedule for:", tomorrow);

    if (!DailyTellerAssignment || !User) {
      console.error("❌ Missing model import in schedule.js");
      return res.status(500).json({ message: "Model import error" });
    }

    let assignments = await DailyTellerAssignment.find({ dayKey: tomorrow }).lean();

    // Auto-generate schedule if none found
    if (!assignments.length) {
      console.log("ℹ️ No assignments found. Generating new schedule for:", tomorrow);

      // Fetch approved tellers (include supervisor_teller acting as teller) 
      // Exclude those with active penalties (skipUntil >= tomorrow)
      let tellers = await User.find({ 
        role: { $in: ["teller", "supervisor_teller"] }, 
        status: "approved",
        $or: [
          { skipUntil: null },
          { skipUntil: { $lt: tomorrow } }
        ]
      })
        .populate("supervisorId", "name role")
        .sort({ lastWorked: 1, totalWorkDays: 1 }) // Prioritize least worked
        .lean();

      // 📅 Filter out tellers with planned absences for tomorrow
      const plannedAbsences = await PlannedAbsence.find({
        tellerId: { $in: tellers.map(t => t._id) },
        $or: [
          // Exact date range match
          {
            startDate: { $lte: tomorrow },
            endDate: { $gte: tomorrow },
            isRecurring: false,
          },
          // Recurring absence on this day of week
          {
            isRecurring: true,
            startDate: { $lte: tomorrow },
            endDate: { $gte: tomorrow },
          },
        ],
      }).lean();

      const absentTellerIds = new Set(plannedAbsences.map(pa => pa.tellerId.toString()));
      
      // Filter out tellers who are absent and check day-of-week for recurring
      const dayOfWeek = new Date(tomorrow + "T00:00:00Z").toLocaleDateString("en-US", {
        weekday: "long",
      });

      tellers = tellers.filter(t => {
        const tellerIdStr = t._id.toString();
        const isAbsent = plannedAbsences.some(pa => 
          pa.tellerId.toString() === tellerIdStr && 
          (pa.isRecurring ? pa.daysOfWeek.includes(dayOfWeek) : true)
        );
        if (isAbsent) {
          console.log(`⏭️ Teller ${t.name || t.username} has planned absence for ${tomorrow}`);
        }
        return !isAbsent;
      });

      if (!tellers.length) {
        console.warn("⚠️ No approved tellers found — cannot generate schedule");
        return res.json({
          success: true,
          date: tomorrow,
          schedule: [],
          message: "No tellers available",
        });
      }

      // Fetch all approved supervisors - REMOVED SUPERVISOR ASSIGNMENT
      // Supervisor assignment should not be part of schedule rotation
      // let supervisors = await User.find({ role: { $in: ["supervisor", "supervisor_teller"] }, status: "approved" })
      //   .select("_id name username role")
      //   .lean();

      // if (!supervisors.length) {
      //   // Fallback to any admin if no supervisors
      //   const admin = await User.findOne({ role: "admin" }).select("_id name username role").lean();
      //   if (admin) supervisors = [admin];
      // }

      // if (!supervisors.length) {
      //   console.warn("⚠️ No supervisors/admin available — assignments will be created without supervisor linkage");
      // }

      // Fair rotation scheduling - prioritize least worked tellers
      let supIndex = 0;
      const MAX_TELLERS = 3; // adjustable limit for daily active tellers
          // If there is a full-week selection for this week, make sure those tellers are always scheduled
          // Use explicit Monday-based week start to match frontend logic (week starts on Monday)
          const weekStartKey = weekStartISO(tomorrow);
          const fullWeek = await FullWeekSelection.findOne({ weekKey: weekStartKey }).lean();
          let preSelectedIds = [];
          if (fullWeek && Array.isArray(fullWeek.tellerIds) && fullWeek.tellerIds.length) {
            // Take only those available and still eligible for this date
            preSelectedIds = tellers.map(t => t._id.toString()).filter(id => fullWeek.tellerIds.map(x => x.toString()).includes(id));
          }

          // Start with pre-selected full-week tellers, then fill up to MAX_TELLERS
          let selected = [];
          if (preSelectedIds.length) {
            selected = tellers.filter(t => preSelectedIds.includes(t._id.toString())).slice(0, MAX_TELLERS);
          }
          if (selected.length < MAX_TELLERS) {
            // Add additional tellers (excluding those already pre-selected)
            const remaining = tellers.filter(t => !selected.find(s => s._id.toString() === t._id.toString()));
            const needed = MAX_TELLERS - selected.length;
            selected = selected.concat(remaining.slice(0, needed));
          }

      const newDocs = [];
      for (const teller of selected) {
        try {
          // Create assignment for selected teller (removed restrictive activeCapital/supervisorId requirement)
          let supervisorName = "";
          // Try to get supervisor name if supervisorId exists
          if (teller.supervisorId) {
            const supervisor = await User.findById(teller.supervisorId).select("name username");
            if (supervisor) {
              supervisorName = supervisor.name || supervisor.username || "";
            }
          }
          
          const doc = {
            dayKey: tomorrow,
            tellerId: teller._id,
            tellerName: teller.name || teller.username,
            supervisorId: teller.supervisorId || null,
            supervisorName,
            status: "scheduled",
            assignmentMethod: preSelectedIds.includes(teller._id.toString()) ? 'full_week' : 'traditional_rotation',
            isFullWeek: preSelectedIds.includes(teller._id.toString()) || false,
          };
          newDocs.push(doc);
          
          // Update teller's work history (only increment when actually assigned, not when scheduled)
          // We'll increment totalWorkDays when they mark present, not when scheduled
          await User.findByIdAndUpdate(teller._id, { 
            lastWorked: tomorrow
            // Removed: $inc: { totalWorkDays: 1 } - this should only happen on completion
          });
        } catch (err) {
          console.error("⚠️ Failed to prepare assignment for teller:", teller.name || teller.username, err.message);
        }
      }

      if (newDocs.length) {
        await DailyTellerAssignment.insertMany(newDocs);
      }

      assignments = await DailyTellerAssignment.find({ dayKey: tomorrow }).lean();
    }

    // Ensure full-week selected tellers are present in assignments even if assignments already existed
    try {
      // Ensure weekStartKey is the Monday of the week (consistent with frontend)
      const weekStartKeyActive = weekStartISO(tomorrow);
      const fullWeekActive = await FullWeekSelection.findOne({ weekKey: weekStartKeyActive }).lean();
      if (fullWeekActive && Array.isArray(fullWeekActive.tellerIds) && fullWeekActive.tellerIds.length) {
        const desiredIds = fullWeekActive.tellerIds.map(x => x.toString());

        // Filter only approved/eligible tellers for tomorrow
        const eligible = await User.find({ _id: { $in: desiredIds }, status: 'approved', $or: [ { skipUntil: null }, { skipUntil: { $lt: tomorrow } } ] }).lean();
        const eligibleIds = eligible.map(u => u._id.toString());

        // Current assigned IDs
        const assignedIds = assignments.map(a => a.tellerId.toString());

        // For each eligible desired id not in assignments, insert or replace
        const missing = eligibleIds.filter(id => !assignedIds.includes(id));
        if (missing.length) {
          console.log(`🔧 Enforcing full-week selection for ${weekStartKeyActive} — missing ${missing.length} teller(s) in assignments`);

          // Try to replace non-full-week assignments first
          for (const missingId of missing) {
            // Find a replaceable assignment (not a full-week)
            // Choose a replacement candidate among non-full-week assignments that minimizes impact on fairness.
            // Strategy: pick the assigned teller with the highest totalWorkDays (and most recent lastWorked) so we keep least-worked tellers assigned.
            let replace = null;
            const nonFull = assignments.filter(a => !a.isFullWeek);
            if (nonFull.length) {
              // Fetch stats for all candidates in one go
              const userIds = nonFull.map(a => a.tellerId);
              const users = await User.find({ _id: { $in: userIds } }).select('totalWorkDays lastWorked').lean();
              const userMap = new Map(users.map(u => [u._id.toString(), u]));

              // Sort nonFull by totalWorkDays desc, then by lastWorked desc (so most-worked/recent appear first)
              nonFull.sort((x, y) => {
                const ux = userMap.get(x.tellerId.toString());
                const uy = userMap.get(y.tellerId.toString());
                const xDays = ux?.totalWorkDays || 0;
                const yDays = uy?.totalWorkDays || 0;
                if (yDays !== xDays) return yDays - xDays;
                const xLast = ux?.lastWorked ? DateTime.fromISO(ux.lastWorked).toMillis() : 0;
                const yLast = uy?.lastWorked ? DateTime.fromISO(uy.lastWorked).toMillis() : 0;
                return yLast - xLast;
              });

              replace = nonFull[0];
            }
            if (replace) {
              console.log(`🔁 Replacing assignment ${replace._id} teller ${replace.tellerId} -> ${missingId}`);
              // fetch user details once
              const newUserForReplace = await User.findById(missingId).select('name username').lean();
              const newName = newUserForReplace?.name || newUserForReplace?.username || '';

              // update document
              await DailyTellerAssignment.findByIdAndUpdate(replace._id, {
                tellerId: missingId,
                tellerName: newName,
                isFullWeek: true,
                assignmentMethod: 'full_week'
              });

              // update assignments in-memory (no await inside callback)
              assignments = assignments.map(a =>
                a._id.toString() === replace._id.toString()
                  ? { ...a, tellerId: missingId, tellerName: newName, isFullWeek: true, assignmentMethod: 'full_week' }
                  : a
              );
            } else {
              // No replaceable slot -> append a new assignment for this missing full-week teller
              const u = await User.findById(missingId).select('name username supervisorId').lean();
              const sup = u?.supervisorId ? (await User.findById(u.supervisorId).select('name username').lean()) : null;
              const doc = {
                dayKey: tomorrow,
                tellerId: missingId,
                tellerName: u?.name || u?.username || 'Unknown',
                supervisorId: u?.supervisorId || null,
                supervisorName: sup?.name || sup?.username || '',
                status: 'scheduled',
                assignmentMethod: 'full_week',
                isFullWeek: true
              };
              const created = await DailyTellerAssignment.create(doc);
              assignments.push(created.toObject());
              console.log(`➕ Appended full-week assignment for teller ${missingId} as ${created._id}`);
            }
          }

          // Refresh assignments from db to reflect changes
          assignments = await DailyTellerAssignment.find({ dayKey: tomorrow }).lean();
        }
      }
    } catch (errEnforce) {
      console.warn('⚠️ Failed to enforce full-week selection for tomorrow:', errEnforce.message);
    }

    // Determine requested range (week|month|year|all)
    const range = (req.query.range || 'all').toLowerCase();
    console.log(`📊 /api/schedule/tomorrow requested with range=${range}`);
    // Compute start boundary depending on range
    const startBoundary = (() => {
      try {
        if (range === 'week') {
          // Use actual Monday of the week, not just 6 days back
          return weekStartISO(tomorrow);
        }
        if (range === 'month') return DateTime.fromISO(tomorrow).startOf('month').toFormat('yyyy-MM-dd');
        if (range === 'year') return DateTime.fromISO(tomorrow).startOf('year').toFormat('yyyy-MM-dd');
        return null; // 'all' - use existing totals
      } catch (e) {
        return null;
      }
    })();

    // Populate teller information including requested range worked days
    const populatedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const teller = await User.findById(assignment.tellerId).select('totalWorkDays name username').lean();

        let rangeWorkDays = teller?.totalWorkDays || 0; // fallback to stored total
        if (startBoundary) {
          // Count teller reports between startBoundary and tomorrow (inclusive)
          try {
            rangeWorkDays = await TellerReport.countDocuments({
              tellerId: assignment.tellerId,
              date: { $gte: startBoundary, $lte: tomorrow }
            });
            console.log(`   • Teller ${assignment.tellerId} has ${rangeWorkDays} reports between ${startBoundary} and ${tomorrow}`);
          } catch (e) {
            console.warn('⚠️ Failed to count reports for range', range, assignment.tellerId, e.message);
            // fallback to existing stored total
            rangeWorkDays = teller?.totalWorkDays || 0;
          }
        }

        return {
          ...assignment,
          totalWorkDays: teller?.totalWorkDays || 0,
          rangeWorkDays,
          range: range
        };
      })
    );

    res.json({ success: true, date: tomorrow, schedule: populatedAssignments });
  } catch (err) {
    console.error("❌ Error fetching/generating tomorrow schedule:", err);
    res.status(500).json({
      message: "Failed to fetch or generate tomorrow schedule",
      error: err.message,
    });
  }
});

/**
 * ✅ GET /api/schedule/by-date/:dateStr
 * Fetch assignments for a specific date (past or future)
 * Params: dateStr (yyyy-MM-dd format)
 */
router.get("/by-date/:dateStr", requireAuth, async (req, res) => {
  try {
    const { dateStr } = req.params;
    console.log("📅 Fetching assignments for date:", dateStr);

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ message: "Invalid date format. Use yyyy-MM-dd" });
    }

    // Fetch assignments for the specified date
    let assignments = await DailyTellerAssignment.find({ dayKey: dateStr })
      .populate("tellerId", "name username role baseSalary")
      .populate("supervisorId", "name username role")
      .lean();

    // If no assignments exist for this date, return empty list
    // (Don't auto-generate, just return what exists)
    res.json({ 
      success: true, 
      date: dateStr, 
      schedule: assignments || [],
      message: assignments.length === 0 ? "No assignments for this date" : "OK"
    });
  } catch (err) {
    console.error("❌ Error fetching schedule for date:", err);
    res.status(500).json({
      message: "Failed to fetch schedule for date",
      error: err.message,
    });
  }
});

/**
 * 🧹 DELETE /api/schedule/tomorrow
 * Clears tomorrow's assignments so they can be regenerated
 */
router.delete("/tomorrow", requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['admin','super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    const tomorrow = formatDate(1);
    const result = await DailyTellerAssignment.deleteMany({ dayKey: tomorrow });
    res.json({ success: true, message: "Tomorrow's schedule cleared", deleted: result.deletedCount, day: tomorrow });
  } catch (err) {
    console.error("❌ Failed to clear tomorrow schedule:", err);
    res.status(500).json({ message: "Failed to clear tomorrow schedule" });
  }
});

/**
 * 🔄 POST /api/schedule/recalculate-work-days-reports
 * Recalculates totalWorkDays for all tellers based on submitted reports
 */
router.post("/recalculate-work-days-reports", requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['admin','super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    console.log("🔄 Recalculating total work days for all tellers based on submitted reports...");

    // Get all tellers and supervisor_tellers
    const tellers = await User.find({
      role: { $in: ['teller', 'supervisor_teller'] }
    });

    let updatedCount = 0;
    for (const teller of tellers) {
      // Count unique days with submitted reports
      const reportDays = await TellerReport.distinct('createdAt', {
        tellerId: teller._id,
        // Only count reports from this year to avoid old data
        createdAt: { $gte: new Date('2025-01-01') }
      });

      const totalWorkDays = reportDays.length;

      if (teller.totalWorkDays !== totalWorkDays) {
        await User.findByIdAndUpdate(teller._id, { totalWorkDays });
        updatedCount++;
      }
    }

    res.json({
      success: true,
      message: `Recalculated work days for ${updatedCount} tellers based on submitted reports`,
      updatedCount
    });

  } catch (err) {
    console.error("❌ Failed to recalculate work days from reports:", err);
    res.status(500).json({ message: "Failed to recalculate work days from reports" });
  }
});

/**
 * 🤖 POST /api/schedule/ai-generate
 * Generate AI-powered schedule based on attendance data
 */
router.post("/ai-generate", requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['admin','super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    const { date, requiredCount = 3, forceRegenerate = false } = req.body;
    const targetDate = date || formatDate(1); // Default to tomorrow
    
    console.log(`🤖 AI Schedule Generation requested for ${targetDate}, requiring ${requiredCount} tellers`);

    // Check if schedule already exists
    const existingSchedule = await DailyTellerAssignment.find({ dayKey: targetDate });
    if (existingSchedule.length && !forceRegenerate) {
      return res.json({
        success: false,
        message: `Schedule for ${targetDate} already exists. Use forceRegenerate=true to override.`,
        existingSchedule
      });
    }

    // Get today's attendance to see who's available
    const todayAttendance = await DailyAttendance.findOne({ 
      date: formatDate(0) 
    });

    if (!todayAttendance || !todayAttendance.presentTellers.length) {
      // Fallback to traditional scheduling if no attendance data
      console.log("⚠️ No attendance data found, falling back to traditional rotation");
      
      const tellers = await User.find({ 
        role: { $in: ["teller", "supervisor_teller"] }, 
        status: "approved",
        $or: [
          { skipUntil: null },
          { skipUntil: { $lt: targetDate } }
        ]
      }).sort({ lastWorked: 1, totalWorkDays: 1 }).limit(requiredCount);

      const assignments = tellers.map(teller => ({
        dayKey: targetDate,
        tellerId: teller._id,
        tellerName: teller.name || teller.username,
        status: "pending",
        assignmentMethod: "traditional_rotation",
        aiScore: 0
      }));

      // Clear existing and insert new
      if (forceRegenerate) {
        await DailyTellerAssignment.deleteMany({ dayKey: targetDate });
      }
      await DailyTellerAssignment.insertMany(assignments);

      return res.json({
        success: true,
        message: `Traditional schedule generated for ${targetDate}`,
        schedule: assignments,
        method: "traditional_rotation"
      });
    }

    // AI-powered scheduling using attendance data
    const presentTellerIds = todayAttendance.presentTellers.map(t => t.userId.toString());
    
    // Get assignment history for fairness calculation (last 30 days)
    const assignmentHistory = await DailyTellerAssignment.find({
      dayKey: { $gte: formatDate(-30) }
    }).sort({ dayKey: -1 });

    // Calculate AI scores for each present teller
    const tellerScores = {};
    
    for (const presentTeller of todayAttendance.presentTellers) {
      const tellerId = presentTeller.userId.toString();
      const tellerData = await User.findById(tellerId);
      
      if (!tellerData || tellerData.status !== 'approved') continue;

      // Base score starts at 100
      let aiScore = 100;
      
      // Factor 1: Recent assignment frequency (lower assignments = higher score)
      const recentAssignments = assignmentHistory.filter(a => a.tellerId.toString() === tellerId).length;
      aiScore += Math.max(0, (10 - recentAssignments) * 5); // Up to +50 for fewer assignments
      
      // Factor 2: Days since last assignment (longer = higher score)
      const lastAssignment = assignmentHistory.find(a => a.tellerId.toString() === tellerId);
      if (lastAssignment) {
        const daysSinceLastAssignment = DateTime.fromISO(targetDate).diff(
          DateTime.fromISO(lastAssignment.dayKey), 'days'
        ).days;
        aiScore += Math.min(daysSinceLastAssignment * 3, 30); // Up to +30 for 10+ days
      } else {
        aiScore += 50; // Never assigned before
      }
      
      // Factor 3: Total work history balance
      const totalAssignments = tellerData.totalWorkDays || 0;
      const avgAssignments = assignmentHistory.length / presentTellerIds.length;
      if (totalAssignments < avgAssignments) {
        aiScore += 20; // Boost for under-worked tellers
      }
      
      // Factor 4: Attendance consistency bonus
      // TODO: Could add attendance history analysis here
      
      tellerScores[tellerId] = {
        userId: tellerId,
        username: presentTeller.username,
        name: presentTeller.name,
        aiScore: Math.round(aiScore),
        recentAssignments,
        totalAssignments,
        lastAssigned: lastAssignment?.dayKey || 'never'
      };
    }

    // Check for full-week selection for the target week and reserve those tellers
    // Use explicit Monday-based week start here too — ensures frontend and backend use the same weekKey
    const weekStartKey = weekStartISO(targetDate);
    const fullWeekSelection = await FullWeekSelection.findOne({ weekKey: weekStartKey }).lean();
    const fullWeekIds = (fullWeekSelection && Array.isArray(fullWeekSelection.tellerIds))
      ? fullWeekSelection.tellerIds.map(x => x.toString())
      : [];

    // Sort by AI score (highest first) and select top candidates
    const rankedTellers = Object.values(tellerScores)
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, Math.min(requiredCount, presentTellerIds.length));

    // Create schedule assignments
    // Ensure full-week selected tellers are always included (try present ones first)
    const forcedTellersPresent = rankedTellers.filter(t => fullWeekIds.includes(t.userId));

    // Also consider full-week selected tellers who might not be present in today's attendance
    const presentIdsSet = new Set(Object.keys(tellerScores));
    const nonPresentFullIds = fullWeekIds.filter(id => !presentIdsSet.has(id));

    // Load non-present full-week users (if any) so they can be forced in the schedule
    const nonPresentFullUsers = [];
    if (nonPresentFullIds.length) {
      const users = await User.find({ _id: { $in: nonPresentFullIds }, status: 'approved' }).lean();
      for (const u of users) {
        nonPresentFullUsers.push({
          userId: u._id.toString(),
          username: u.username,
          name: u.name,
          aiScore: 200, // very high to prioritize
          recentAssignments: 0,
          totalAssignments: u.totalWorkDays || 0,
          lastAssigned: u.lastWorked || 'never'
        });
      }
    }

    const forcedTellers = forcedTellersPresent.concat(nonPresentFullUsers).slice(0, requiredCount);

    // Remaining selection from ranked tellers excluding forced ones
    const remainingCandidates = rankedTellers.filter(t => !forcedTellers.find(f => f.userId === t.userId));

    const finalSelection = forcedTellers.concat(remainingCandidates).slice(0, requiredCount);

    const aiAssignments = finalSelection.map((teller, index) => ({
      dayKey: targetDate,
      tellerId: teller.userId,
      tellerName: teller.name,
      status: "pending",
      assignmentMethod: fullWeekIds.includes(teller.userId) ? 'full_week' : "ai_attendance_based",
      isFullWeek: fullWeekIds.includes(teller.userId) || false,
      aiScore: teller.aiScore,
      rank: index + 1,
      reason: `Score: ${teller.aiScore} (Recent: ${teller.recentAssignments}, Last: ${teller.lastAssigned})`
    }));

    // Clear existing and insert new AI-generated schedule
    if (forceRegenerate) {
      await DailyTellerAssignment.deleteMany({ dayKey: targetDate });
    }
    await DailyTellerAssignment.insertMany(aiAssignments);

    // Update work history for selected tellers (only set lastWorked, don't increment totalWorkDays yet)
    for (const assignment of aiAssignments) {
      await User.findByIdAndUpdate(assignment.tellerId, {
        lastWorked: targetDate
        // Removed: $inc: { totalWorkDays: 1 } - this should only happen when they mark present
      });
    }

    console.log(`🤖 AI Schedule generated for ${targetDate}:`, {
      selected: aiAssignments.length,
      available: presentTellerIds.length,
      method: 'ai_attendance_based'
    });

    res.json({
      success: true,
      message: `AI-powered schedule generated for ${targetDate}`,
      schedule: aiAssignments,
      method: "ai_attendance_based",
      attendanceData: {
        totalPresent: presentTellerIds.length,
        attendanceDate: formatDate(0),
        attendanceRate: todayAttendance.attendanceRate
      },
      alternatives: Object.values(tellerScores).slice(requiredCount) // Show other candidates
    });
    
  } catch (err) {
    console.error("❌ AI schedule generation failed:", err);
    res.status(500).json({ 
      message: "Failed to generate AI schedule", 
      error: err.message 
    });
  }
});

/**
 * ✅ GET /api/schedule/history
 * Returns past 7 days of teller assignments
 */
router.get("/history", async (req, res) => {
  try {
    const start = DateTime.now().setZone("Asia/Manila").minus({ days: 7 });
    const sched = await DailyTellerAssignment.find({
      dayKey: { $gte: start.toFormat("yyyy-MM-dd") },
    })
      .sort({ dayKey: -1 })
      .lean();

    res.json({ success: true, history: sched || [] });
  } catch (err) {
    console.error("❌ Failed to get schedule history:", err);
    res.status(500).json({ message: "Failed to get schedule history" });
  }
});

/**
 * ✅ POST /api/schedule/mark-present
 * Marks a teller as present and updates work history
 */
router.post("/mark-present", requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['supervisor', 'admin', 'super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    const { tellerId, tellerName, dayKey } = req.body;
    // Supervisors may only mark attendance for TODAY. For attempts targeting future days (e.g. tomorrow) deny.
    if (req.user?.role === 'supervisor') {
      const todayKey = formatDate(0);
      if (!dayKey || dayKey !== todayKey) {
        return res.status(403).json({ message: 'Forbidden - supervisors may only mark attendance for today' });
      }
    }

    await DailyTellerAssignment.updateOne(
      { tellerId, dayKey },
      { $set: { status: "present" } },
      { upsert: true }
    );

    // Update work history
    await User.findByIdAndUpdate(tellerId, {
      $set: { lastWorked: dayKey },
      $inc: { totalWorkDays: 1 }
    });

    // 🔄 Real-time update for all clients
    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId,
        tellerName,
        status: "present",
        dayKey,
      });
    }

    res.json({ success: true, message: `${tellerName} marked as present` });
  } catch (err) {
    console.error("❌ Mark Present error:", err);
    res.status(500).json({ message: "Failed to mark present" });
  }
});

/**
 * ✅ POST /api/schedule/mark-absent
 * Marks a teller as absent with reason and penalty
 */
router.post("/mark-absent", requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['supervisor', 'admin', 'super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    const { tellerId, tellerName, dayKey, reason, penaltyDays } = req.body;
    // Supervisors may only mark absence for TODAY
    if (req.user?.role === 'supervisor') {
      const todayKey = formatDate(0);
      if (!dayKey || dayKey !== todayKey) {
        return res.status(403).json({ message: 'Forbidden - supervisors may only mark absence for today' });
      }
    }

    // Update assignment with absent status and reason
    await DailyTellerAssignment.updateOne(
      { tellerId, dayKey },
      { 
        $set: { 
          status: "absent",
          absentReason: reason || "No reason provided",
          penaltyDays: penaltyDays || 0
        } 
      },
      { upsert: true }
    );

    // Apply penalty: set skipUntil date on the teller
    if (penaltyDays && penaltyDays > 0) {
      const skipUntilDate = DateTime.now()
        .setZone("Asia/Manila")
        .plus({ days: penaltyDays })
        .toFormat("yyyy-MM-dd");
      
      await User.findByIdAndUpdate(tellerId, {
        $set: { 
          skipUntil: skipUntilDate,
          lastAbsentReason: reason || "No reason provided"
        }
      });
      
      console.log(`⏭️ Teller ${tellerName} will skip work until ${skipUntilDate} (penalty: ${penaltyDays} days)`);
    }

    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId,
        tellerName,
        status: "absent",
        dayKey,
        reason,
        penaltyDays
      });
    }

    res.json({ 
      success: true, 
      message: `Marked ${tellerName} as absent${penaltyDays > 0 ? ` with ${penaltyDays} day penalty` : ''}` 
    });
  } catch (err) {
    console.error("❌ Mark Absent error:", err);
    res.status(500).json({ message: "Failed to mark absent" });
  }
});

/**
 * ✅ Debug route for quick testing
 */
router.get("/debug-test", async (req, res) => {
  try {
    const count = await User.countDocuments({ role: "teller" });
    res.json({ ok: true, tellers: count });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ Mark a teller as present by ID
router.put("/mark-present/:assignmentId", requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['supervisor', 'admin', 'super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    const { assignmentId } = req.params;
    const assignment = await DailyTellerAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Supervisors may only update today's assignments
    if (req.user?.role === 'supervisor') {
      const todayKey = formatDate(0);
      if (assignment.dayKey !== todayKey) {
        return res.status(403).json({ message: 'Forbidden - supervisors may only modify today assignments' });
      }
    }

    assignment.status = "present";
    await assignment.save();

    // ✅ Update work history - increment totalWorkDays when marked present
    await User.findByIdAndUpdate(assignment.tellerId, {
      $set: { lastWorked: assignment.dayKey },
      $inc: { totalWorkDays: 1 }
    });

    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId: assignment.tellerId,
        tellerName: assignment.tellerName,
        status: "present",
        dayKey: assignment.dayKey,
      });
    }

    res.json({ success: true, message: "Marked as present", assignment });
  } catch (err) {
    console.error("❌ Mark Present error:", err);
    res.status(500).json({ message: "Failed to mark present" });
  }
});

// ✅ Mark a teller as absent by ID
router.put("/mark-absent/:assignmentId", requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['supervisor', 'admin', 'super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    const { assignmentId } = req.params;
    const assignment = await DailyTellerAssignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Supervisors may only update today's assignments
    if (req.user?.role === 'supervisor') {
      const todayKey = formatDate(0);
      if (assignment.dayKey !== todayKey) {
        return res.status(403).json({ message: 'Forbidden - supervisors may only modify today assignments' });
      }
    }

    assignment.status = "absent";
    await assignment.save();

    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId: assignment.tellerId,
        tellerName: assignment.tellerName,
        status: "absent",
        dayKey: assignment.dayKey,
      });
    }

    res.json({ success: true, message: "Marked as absent", assignment });
  } catch (err) {
    console.error("❌ Mark Absent error:", err);
    res.status(500).json({ message: "Failed to mark absent" });
  }
});

/**
 * ✅ DELETE /api/schedule/assignment/:assignmentId
 * Remove an assignment for a specific teller on a specific day
 */
router.delete("/assignment/:assignmentId", requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['supervisor', 'admin', 'super_admin'])) {
    return res.status(403).json({ message: 'Forbidden - insufficient role' });
  }
  
  try {
    const { assignmentId } = req.params;
    const assignment = await DailyTellerAssignment.findById(assignmentId);
    
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Supervisors may only delete today's assignments
    if (req.user?.role === 'supervisor') {
      const todayKey = formatDate(0);
      if (assignment.dayKey !== todayKey) {
        return res.status(403).json({ message: 'Forbidden - supervisors may only delete today assignments' });
      }
    }

    const deletedAssignment = await DailyTellerAssignment.findByIdAndDelete(assignmentId);

    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId: deletedAssignment.tellerId,
        tellerName: deletedAssignment.tellerName,
        status: "removed",
        dayKey: deletedAssignment.dayKey,
      });
    }

    res.json({ success: true, message: "Assignment removed successfully", assignment: deletedAssignment });
  } catch (err) {
    console.error("❌ Delete Assignment error:", err);
    res.status(500).json({ message: "Failed to delete assignment" });
  }
});

/**
 * ✅ SUGGESTED TELLERS (with work history based on weekly reports)
 * GET /api/schedule/suggest/:dayKey
 * Fetches or generates and caches suggested tellers for a specific day
 * Query params: startDate, endDate (optional, format: yyyy-MM-dd)
 * If not provided, defaults to Monday-Sunday of the week containing dayKey
 * NOTE: No authentication restriction - all roles can view
 */
router.get("/suggest/:dayKey", async (req, res) => {
  try {
    const { dayKey } = req.params;
    const { startDate, endDate } = req.query;

    // Check if suggestions already exist in database for this dayKey
    const existingSuggestions = await SuggestedTellerAssignment.findOne({ dayKey }).lean();
    if (existingSuggestions && existingSuggestions.suggestions && existingSuggestions.suggestions.length > 0) {
      console.log(`✅ Found cached suggestions for ${dayKey} (${existingSuggestions.suggestions.length} tellers)`);
      return res.json({
        success: true,
        suggestions: existingSuggestions.suggestions,
        dateRange: existingSuggestions.dateRange,
        cached: true,
        message: `Cached suggested tellers found (based on weekly reports)`,
      });
    }

    // If not cached, generate new suggestions
    console.log(`🔄 Generating new suggestions for ${dayKey}...`);

    // Determine date range
    let weekStart, weekEnd;
    
    if (startDate && endDate) {
      // Use provided range
      weekStart = startDate;
      weekEnd = endDate;
      console.log(`📊 Using provided date range: ${weekStart} to ${weekEnd}`);
    } else {
      // Default: calculate Monday to Sunday of the week containing dayKey
      const targetDate = DateTime.fromISO(dayKey).setZone("Asia/Manila");
      // Get Monday of this week (day 1 is Monday)
      const mondayOfWeek = targetDate.startOf('week').toFormat("yyyy-MM-dd");
      // Get Sunday of this week
      const sundayOfWeek = targetDate.endOf('week').toFormat("yyyy-MM-dd");
      
      weekStart = mondayOfWeek;
      weekEnd = sundayOfWeek;
      console.log(`📊 Calculating weekly worked days from ${weekStart} to ${weekEnd} (Monday-Sunday)`);
    }

    // Get tomorrow's date (the target day for suggestions)
    const targetDate = DateTime.fromISO(dayKey).setZone("Asia/Manila");
    const tomorrow = targetDate.plus({ days: 1 }).toFormat("yyyy-MM-dd");

    // Find tellers already assigned to the target day AND tomorrow
    const assignedToday = await DailyTellerAssignment.find({ dayKey }).distinct("tellerId");
    const assignedTomorrow = await DailyTellerAssignment.find({ dayKey: tomorrow }).distinct("tellerId");
    
    // Exclude both today's and tomorrow's assignments
    const excludedIds = [...new Set([...assignedToday, ...assignedTomorrow])];

    // Find available tellers, exclude those with active penalties
    const availableTellers = await User.find({
      _id: { $nin: excludedIds },
      role: { $in: ["teller", "supervisor_teller"] },
      status: "approved",
      $or: [
        { skipUntil: null },
        { skipUntil: { $lt: dayKey } }
      ]
    })
      .select("_id name username contact status lastWorked skipUntil lastAbsentReason")
      .lean();

    // Helper function to get day of week name
    const getDayOfWeek = (dateStr) => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const d = new Date(dateStr + 'T00:00:00Z');
      return days[d.getUTCDay()];
    };

    // Calculate daily and weekly worked days for each teller based on their reports
    const suggestionsWithWeeklyData = await Promise.all(
      availableTellers.map(async (teller) => {
        // Count reports for each day of the week
        const dailyWorkedDays = {};
        let totalWeeklyDays = 0;

        // Generate all dates in the range
        const allDates = [];
        let currentDate = DateTime.fromISO(weekStart);
        const endDateTime = DateTime.fromISO(weekEnd);
        
        while (currentDate <= endDateTime) {
          const dateStr = currentDate.toFormat("yyyy-MM-dd");
          allDates.push(dateStr);
          currentDate = currentDate.plus({ days: 1 });
        }

        // Count reports for each day
        for (const dateStr of allDates) {
          const reportCount = await TellerReport.countDocuments({
            tellerId: teller._id,
            date: dateStr
          });
          
          const dayName = getDayOfWeek(dateStr);
          dailyWorkedDays[dayName] = reportCount;
          totalWeeklyDays += reportCount;
        }

        // Get the most recent report date for lastWorked
        const latestReport = await TellerReport.findOne({
          tellerId: teller._id,
          date: {
            $gte: weekStart,
            $lte: weekEnd
          }
        })
          .sort({ date: -1 })
          .select("date")
          .lean();

        return {
          ...teller,
          weeklyWorkedDays: totalWeeklyDays,
          dailyWorkedDays, // { Monday: 1, Tuesday: 0, Wednesday: 1, etc. }
          lastWorked: latestReport ? latestReport.date : teller.lastWorked || null,
          dateRange: { startDate: weekStart, endDate: weekEnd }
        };
      })
    );

    // Sort by weekly worked days (ascending - least worked first for fair rotation)
    const suggestions = suggestionsWithWeeklyData
      .sort((a, b) => a.weeklyWorkedDays - b.weeklyWorkedDays);
    // Removed: .slice(0, 10) - now show ALL available tellers

    console.log(`📊 Found ${suggestions.length} suggested tellers with weekly data`);

    // Save suggestions to database for future retrieval
    try {
      await SuggestedTellerAssignment.findOneAndUpdate(
        { dayKey },
        {
          dayKey,
          suggestions,
          dateRange: { startDate: weekStart, endDate: weekEnd },
        },
        { upsert: true, new: true }
      );
      console.log(`💾 Saved ${suggestions.length} suggestions for ${dayKey}`);
    } catch (err) {
      console.warn(`⚠️ Failed to cache suggestions:`, err.message);
      // Don't fail the request, just continue
    }

    res.json({
      success: true,
      suggestions,
      dateRange: { startDate: weekStart, endDate: weekEnd },
      cached: false,
      message: suggestions.length
        ? "Suggested replacement tellers found (based on weekly reports)"
        : "No available tellers to suggest",
    });
  } catch (err) {
    console.error("❌ Suggest tellers error:", err);
    res.status(500).json({ message: "Failed to suggest tellers" });
  }
});

/**
 * ✅ PUT /api/schedule/set-teller-count
 * Updates the desired teller count for tomorrow's schedule
 */
router.put("/set-teller-count", requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['supervisor', 'admin', 'super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    // Supervisors are not allowed to mutate tomorrow's schedule (view-only). Admins and super_admin can proceed.
    if (req.user?.role === 'supervisor') {
      return res.status(403).json({ message: 'Forbidden - supervisors cannot change tomorrow schedule' });
    }
    const { tellerCount } = req.body;

    console.log("📊 Set teller count request:", { tellerCount, body: req.body });

    if (!tellerCount || tellerCount < 1) {
      console.log("❌ Invalid teller count:", tellerCount);
      return res.status(400).json({ message: "Invalid teller count" });
    }

    const tomorrow = formatDate(1);
    console.log(`📊 Setting teller count to ${tellerCount} for ${tomorrow}`);

    // Get current assignments
    const currentAssignments = await DailyTellerAssignment.find({ dayKey: tomorrow });
    const currentCount = currentAssignments.length;
    console.log(`📊 Current assignments: ${currentCount}`);

    if (tellerCount > currentCount) {
      // Need to add more tellers
      const needed = tellerCount - currentCount;
      console.log(`➕ Need to add ${needed} more tellers`);

      // Get already assigned teller IDs
      const assignedIds = currentAssignments.map(a => a.tellerId.toString());
      console.log(`📊 Already assigned IDs:`, assignedIds);

      // Find available tellers not already assigned
      const availableTellers = await User.find({
        role: { $in: ["teller", "supervisor_teller"] },
        status: "approved",
        _id: { $nin: assignedIds },
        $or: [
          { skipUntil: null },
          { skipUntil: { $lt: tomorrow } }
        ]
      })
        .sort({ totalWorkDays: 1, lastWorked: 1 }) // Fair rotation: least worked first
        .limit(needed)
        .lean();

      console.log(`📊 Found ${availableTellers.length} available tellers:`, availableTellers.map(t => ({ id: t._id, name: t.name, totalWorkDays: t.totalWorkDays })));

      // Remove supervisor assignment logic - just create schedule entries
      const newAssignments = availableTellers.map((teller) => ({
        dayKey: tomorrow,
        tellerId: teller._id,
        tellerName: teller.name || teller.username,
        status: "scheduled",
      }));

      console.log(`📊 New assignments to create:`, newAssignments);

      if (newAssignments.length > 0) {
        const inserted = await DailyTellerAssignment.insertMany(newAssignments);
        console.log(`✅ Added ${inserted.length} tellers`);

        // Update work history for newly assigned tellers (only set lastWorked, don't increment totalWorkDays)
        for (const teller of availableTellers) {
          console.log(`📊 Updating teller ${teller.name || teller.username} (${teller._id})`);
          const updateResult = await User.findByIdAndUpdate(teller._id, {
            lastWorked: tomorrow
            // Removed: $inc: { totalWorkDays: 1 } - this should only happen when marked present
          });
          console.log(`📊 Update result for ${teller.name}:`, updateResult ? 'success' : 'failed');
        }
      }

    } else if (tellerCount < currentCount) {
      // Need to remove tellers
      const toRemove = currentCount - tellerCount;
      console.log(`➖ Need to remove ${toRemove} tellers`);

      // Remove the last assigned tellers (most recently added)
      const toDelete = currentAssignments.slice(-toRemove);
      const deleteIds = toDelete.map(a => a._id);

      console.log(`📊 Deleting assignments:`, deleteIds);
      const deleteResult = await DailyTellerAssignment.deleteMany({ _id: { $in: deleteIds } });
      console.log(`✅ Removed ${deleteResult.deletedCount} tellers`);
    }

    // Get updated assignments
    const updatedAssignments = await DailyTellerAssignment.find({ dayKey: tomorrow });
    console.log(`📊 Final assignments count: ${updatedAssignments.length}`);

    res.json({
      success: true,
      message: `Teller count updated to ${tellerCount}`,
      count: updatedAssignments.length,
      schedule: updatedAssignments
    });

  } catch (err) {
    console.error("❌ Set teller count error:", err);
    console.error("❌ Error stack:", err.stack);
    res.status(500).json({
      message: "Failed to set teller count",
      error: err.message,
      stack: err.stack
    });
  }
});

/**
 * ✅ PUT /api/schedule/full-week
 * Create or update a week's full-week teller selection
 * Body: { weekKey: 'yyyy-MM-dd' (week start), tellerIds: [<id>], count: <number> }
 */
router.put('/full-week', requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['supervisor', 'admin', 'super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    // Full-week selection modifies future assignments (applies starting tomorrow or later) — disallow for supervisor role
    if (req.user?.role === 'supervisor') {
      return res.status(403).json({ message: 'Forbidden - supervisors cannot create/update full-week selections' });
    }
    const { weekKey, tellerIds = [], count = 0 } = req.body;
    if (!weekKey) return res.status(400).json({ message: 'weekKey is required (use week start yyyy-MM-dd)' });

    // Validate tellerIds
    const validTellers = Array.isArray(tellerIds) ? tellerIds : [];

    // If preview requested, compute the changes but do not apply
    const preview = req.query.preview === 'true' || req.body.preview === true;
    const confirmApply = req.body.confirmApply === true || req.query.apply === 'true';

    // normalize selection
    const desiredIds = validTellers.map((x) => x.toString());

    // For full-week operations, compute all days in the week starting at weekKey
    // However apply only from tomorrow (next day) through the week end (Sunday) so changes don't retroactively affect past days
    const weekStart = DateTime.fromISO(weekKey).startOf('day');
    const today = DateTime.now().setZone('Asia/Manila');
    const tomorrowDate = today.plus({ days: 1 }).toFormat('yyyy-MM-dd');
    // Start at the later of weekStart and tomorrow
    const applyStart = DateTime.fromISO(tomorrowDate) > weekStart ? DateTime.fromISO(tomorrowDate) : weekStart;
    // Compute dayKeys from applyStart until the week end (Sunday) — weekKey start + 6
    const weekEnd = weekStart.plus({ days: 6 }).endOf('day');
    const dayKeys = [];
    for (let dt = applyStart; dt <= weekEnd; dt = dt.plus({ days: 1 })) {
      dayKeys.push(dt.toFormat('yyyy-MM-dd'));
    }

    // Gather planned changes (replacements/appends) per day
    const planned = [];

    for (const dayKey of dayKeys) {
      // current assignments for that day
      let assignments = await DailyTellerAssignment.find({ dayKey }).lean();
      // find desired tellers that are eligible (approved & not skipped)
      const eligible = await User.find({ _id: { $in: desiredIds }, status: 'approved', $or: [{ skipUntil: null }, { skipUntil: { $lt: dayKey } }] }).lean();
      const eligibleIds = eligible.map(u => u._id.toString());

      const assignedIds = assignments.map(a => a.tellerId.toString());
      const missing = eligibleIds.filter(id => !assignedIds.includes(id));

      const replacements = [];
      const appends = [];

      // For each missing id, see if there is a non-full-week slot to replace
      for (const missingId of missing) {
        const nonFull = assignments.filter(a => !a.isFullWeek);
        let replace = null;
        if (nonFull.length) {
          const userIds = nonFull.map(a => a.tellerId);
          const users = await User.find({ _id: { $in: userIds } }).select('totalWorkDays lastWorked').lean();
          const userMap = new Map(users.map(u => [u._id.toString(), u]));

          nonFull.sort((x, y) => {
            const ux = userMap.get(x.tellerId.toString());
            const uy = userMap.get(y.tellerId.toString());
            const xDays = ux?.totalWorkDays || 0;
            const yDays = uy?.totalWorkDays || 0;
            if (yDays !== xDays) return yDays - xDays;
            const xLast = ux?.lastWorked ? DateTime.fromISO(ux.lastWorked).toMillis() : 0;
            const yLast = uy?.lastWorked ? DateTime.fromISO(uy.lastWorked).toMillis() : 0;
            return yLast - xLast;
          });

          replace = nonFull[0];
        }
        if (replace) {
          replacements.push({ dayKey, assignmentId: replace._id.toString(), from: { id: replace.tellerId.toString(), name: replace.tellerName }, to: { id: missingId } });
          // consume that slot in memory
          assignments = assignments.filter(a => a._id.toString() !== replace._id.toString());
        } else {
          appends.push({ dayKey, to: { id: missingId } });
        }
      }

      if (replacements.length || appends.length) {
        planned.push({ dayKey, replacements, appends });
      }
    }

    if (preview) {
      return res.json({ success: true, preview: true, planned });
    }

    // If not preview and not confirmApply, do a silent upsert (legacy behavior)
    if (!confirmApply) {
      const updated = await FullWeekSelection.findOneAndUpdate(
        { weekKey },
        { $set: { tellerIds: validTellers, count: Number(count) || validTellers.length, createdBy: req.user?._id || null, createdAt: new Date() } },
        { upsert: true, new: true }
      );
      return res.json({ success: true, selection: updated, planned });
    }

    // confirmApply: apply changes and create audit
    const appliedChanges = [];
    for (const item of planned) {
      const { dayKey, replacements, appends } = item;
      // Apply replacements
      for (const r of replacements) {
        try {
          const oldAssign = await DailyTellerAssignment.findById(r.assignmentId).lean();
          const newUser = await User.findById(r.to.id).select('name username').lean();
          await DailyTellerAssignment.findByIdAndUpdate(r.assignmentId, {
            tellerId: r.to.id,
            tellerName: newUser?.name || newUser?.username || '',
            isFullWeek: true,
            assignmentMethod: 'full_week'
          });
          appliedChanges.push({ dayKey, action: 'replace', assignmentId: r.assignmentId, oldTellerId: oldAssign?.tellerId, oldTellerName: oldAssign?.tellerName, newTellerId: r.to.id, newTellerName: newUser?.name || newUser?.username || '' });
        } catch (e) {
          console.warn('⚠️ Failed to apply replacement', e.message);
        }
      }

      // Apply appends
      for (const a of appends) {
        try {
          const u = await User.findById(a.to.id).select('name username supervisorId').lean();
          const sup = u?.supervisorId ? (await User.findById(u.supervisorId).select('name username').lean()) : null;
          const doc = {
            dayKey,
            tellerId: u._id,
            tellerName: u?.name || u?.username || 'Unknown',
            supervisorId: u?.supervisorId || null,
            supervisorName: sup?.name || sup?.username || '',
            status: 'scheduled',
            assignmentMethod: 'full_week',
            isFullWeek: true
          };
          const created = await DailyTellerAssignment.create(doc);
          appliedChanges.push({ dayKey, action: 'append', assignmentId: created._id, oldTellerId: null, oldTellerName: null, newTellerId: u._id, newTellerName: u?.name || u?.username || '' });
        } catch (e) {
          console.warn('⚠️ Failed to append assignment', e.message);
        }
      }
    }

    // Save selection now and create audit
    const updated = await FullWeekSelection.findOneAndUpdate(
      { weekKey },
      { $set: { tellerIds: validTellers, count: Number(count) || validTellers.length, createdBy: req.user?._id || null, createdAt: new Date() } },
      { upsert: true, new: true }
    );

    const audit = new FullWeekAudit({ weekKey, createdBy: req.user?._id, selection: validTellers, count: Number(count) || validTellers.length, changes: appliedChanges });
    await audit.save();

    res.json({ success: true, applied: true, auditId: audit._id, appliedChanges });
  } catch (err) {
    console.error('❌ Full-week update error:', err);
    res.status(500).json({ message: 'Failed to set full-week selection' });
  }
});

/**
 * ✅ GET /api/schedule/full-week/:weekKey
 * Fetch the saved full-week selection for a week
 */
router.get('/full-week/:weekKey', requireAuth, async (req, res) => {
  try {
    const { weekKey } = req.params;
    const record = await FullWeekSelection.findOne({ weekKey }).populate('tellerIds', 'name username role').lean();
    res.json({ success: true, selection: record || null });
  } catch (err) {
    console.error('❌ Get full-week selection error:', err);
    res.status(500).json({ message: 'Failed to get full-week selection' });
  }
});

/**
 * ✅ DELETE /api/schedule/full-week/:weekKey
 * Remove the saved full-week selection for a week (reset)
 */
router.delete('/full-week/:weekKey', requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['supervisor', 'admin', 'super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    if (req.user?.role === 'supervisor') return res.status(403).json({ message: 'Forbidden - supervisors cannot delete full-week selections' });
    const { weekKey } = req.params;
    const del = await FullWeekSelection.deleteMany({ weekKey });
    res.json({ success: true, deleted: del.deletedCount });
  } catch (err) {
    console.error('❌ Delete full-week selection error:', err);
    res.status(500).json({ message: 'Failed to delete full-week selection' });
  }
});

/**
 * ✅ DELETE /api/schedule/full-week/teller/:tellerId/:dayKey
 * Remove a specific teller from full-week assignments for a day
 */
router.delete('/full-week/teller/:tellerId/:dayKey', requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['supervisor', 'admin', 'super_admin'])) {
    return res.status(403).json({ message: 'Forbidden - insufficient role' });
  }
  
  try {
    const { tellerId, dayKey } = req.params;
    
    // Supervisors can only modify today's assignments
    if (req.user?.role === 'supervisor') {
      const todayKey = formatDate(0);
      if (dayKey !== todayKey) {
        return res.status(403).json({ message: 'Forbidden - supervisors can only modify today' });
      }
    }

    // Remove the teller from full-week assignments
    const result = await DailyTellerAssignment.deleteMany({
      tellerId,
      isFullWeek: true,
      dayKey: { $gte: dayKey }  // Remove from this day onwards for the week
    });

    // Also remove from FullWeekSelection if exists
    const weekKey = weekStartISO(dayKey);
    await FullWeekSelection.updateOne(
      { weekKey },
      { $pull: { tellerIds: tellerId } }
    );

    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId,
        status: "full_week_removed",
        dayKey,
      });
    }

    res.json({ 
      success: true, 
      message: "Teller removed from full-week assignments",
      removed: result.deletedCount 
    });
  } catch (err) {
    console.error("❌ Remove teller from full-week error:", err);
    res.status(500).json({ message: "Failed to remove teller from full-week" });
  }
});

/**
 * GET /api/schedule/full-week/audits
 * List audits (admin/super_admin)
 */
router.get('/full-week/audits', requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['admin', 'super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    const { weekKey } = req.query;
    const q = weekKey ? { weekKey } : {};
    const audits = await FullWeekAudit.find(q).populate('createdBy', 'name username').sort({ createdAt: -1 }).lean();
    res.json({ success: true, audits });
  } catch (err) {
    console.error('❌ Fetch audits error:', err);
    res.status(500).json({ message: 'Failed to fetch audits' });
  }
});

/**
 * POST /api/schedule/full-week/undo/:auditId
 * Undo the applied full-week audit (admin/super_admin only)
 */
router.post('/full-week/undo/:auditId', requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['admin', 'super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    const { auditId } = req.params;
    const audit = await FullWeekAudit.findById(auditId).lean();
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    if (audit.reverted) return res.status(400).json({ message: 'Audit already reverted' });

    const changes = audit.changes || [];
    const results = [];

    for (const ch of changes) {
      if (ch.action === 'replace') {
        try {
          await DailyTellerAssignment.findByIdAndUpdate(ch.assignmentId, {
            tellerId: ch.oldTellerId || null,
            tellerName: ch.oldTellerName || '',
            isFullWeek: false,
            assignmentMethod: 'traditional_rotation'
          });
          results.push({ assignmentId: ch.assignmentId, status: 'reverted' });
        } catch (e) {
          console.warn('⚠️ Failed to revert replacement', e.message);
          results.push({ assignmentId: ch.assignmentId, status: 'failed', reason: e.message });
        }
      }
      if (ch.action === 'append') {
        try {
          // delete the appended assignment
          await DailyTellerAssignment.deleteOne({ _id: ch.assignmentId });
          results.push({ assignmentId: ch.assignmentId, status: 'deleted' });
        } catch (e) {
          console.warn('⚠️ Failed to delete appended assignment', e.message);
          results.push({ assignmentId: ch.assignmentId, status: 'failed', reason: e.message });
        }
      }
    }

    // mark audit reverted
    await FullWeekAudit.findByIdAndUpdate(auditId, { $set: { reverted: true, revertedBy: req.user?._id, revertedAt: new Date() } });

    res.json({ success: true, reverted: true, results });
  } catch (err) {
    console.error('❌ Undo audit error:', err);
    res.status(500).json({ message: 'Failed to undo audit' });
  }
});

/**
 * ✅ GET /api/schedule/today-working/:date
 * Get tellers who have submitted reports for the specified date
 */
router.get("/today-working/:date", requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    console.log("🔍 Backend: Fetching working tellers for date:", date);

    // Find all tellers who have submitted reports for this date
    const reports = await TellerReport.find({ date })
      .populate('tellerId', 'name username role status')
      .select('tellerId tellerName')
      .lean();

    console.log("📊 Backend: Found", reports.length, "reports for date", date);

    // Group by teller and remove duplicates
    const tellerMap = new Map();
    reports.forEach(report => {
      if (report.tellerId && !tellerMap.has(report.tellerId._id.toString())) {
        tellerMap.set(report.tellerId._id.toString(), {
          _id: report.tellerId._id,
          name: report.tellerName || report.tellerId.name,
          username: report.tellerId.username,
          role: report.tellerId.role,
          status: report.tellerId.status,
          hasReport: true
        });
      }
    });

    const tellers = Array.from(tellerMap.values());

    console.log("✅ Backend: Returning", tellers.length, "unique tellers for date", date);
    res.json({
      success: true,
      date,
      tellers,
      count: tellers.length
    });
  } catch (err) {
    console.error("❌ Today working tellers error:", err);
    res.status(500).json({ message: "Failed to get today's working tellers" });
  }
});
router.put("/replace/:assignmentId", requireAuth, async (req, res) => {
  if (!isAllowedScheduleUser(req.user, ['supervisor', 'admin', 'super_admin'])) return res.status(403).json({ message: 'Forbidden - insufficient role' });
  try {
    const { assignmentId } = req.params;
    const { replacementId } = req.body;

    const assignment = await DailyTellerAssignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });

    // Supervisors cannot perform replacements for assignments that are not for today
    if (req.user?.role === 'supervisor') {
      const today = formatDate(0);
      if (assignment.dayKey !== today) {
        return res.status(403).json({ message: 'Forbidden - supervisors cannot replace assignments for future dates' });
      }
    }

    const replacement = await User.findById(replacementId).lean();
    if (!replacement) return res.status(404).json({ message: "Replacement teller not found" });

    assignment.tellerId = replacement._id;
    assignment.tellerName = replacement.name;
    assignment.status = "replaced";
    await assignment.save();

    replacement.lastWorked = formatDate(1); // update lastWorked to tomorrow
    await User.findByIdAndUpdate(replacementId, { lastWorked: replacement.lastWorked });

    if (global.io) {
      global.io.emit("scheduleUpdated", {
        tellerId: replacement._id,
        tellerName: replacement.name,
        status: "replaced",
        dayKey: assignment.dayKey,
      });
    }

    res.json({
      success: true,
      message: "Replacement teller assigned",
      assignment,
    });
  } catch (err) {
    console.error("❌ Replace teller error:", err);
    res.status(500).json({ message: "Failed to replace teller" });
  }
});

/**
 * ✅ POST /api/schedule/plan-absence
 * Teller plans to be absent for specific days/week
 */
router.post("/plan-absence", requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, reason, daysOfWeek, isRecurring } = req.body;
    const tellerId = req.user._id;
    const tellerName = req.user.name || req.user.username;

    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    // Create planned absence record
    const absence = new PlannedAbsence({
      tellerId,
      tellerName,
      startDate,
      endDate,
      reason: reason || "Personal",
      daysOfWeek: daysOfWeek || [], // e.g., ['Monday', 'Wednesday']
      isRecurring: isRecurring || false,
    });

    await absence.save();
    console.log(`📅 Teller ${tellerName} planned absence from ${startDate} to ${endDate}`);

    // Emit real-time update
    if (global.io) {
      global.io.emit("absencePlanned", {
        tellerId: tellerId.toString(),
        tellerName,
        startDate,
        endDate,
        daysOfWeek,
      });
    }

    res.json({
      success: true,
      message: "Absence planned successfully",
      absence,
    });
  } catch (err) {
    console.error("❌ Plan absence error:", err);
    res.status(500).json({ message: "Failed to plan absence" });
  }
});

/**
 * ✅ GET /api/schedule/planned-absences
 * Get current user's planned absences
 */
router.get("/planned-absences", requireAuth, async (req, res) => {
  try {
    const tellerId = req.user._id;
    const absences = await PlannedAbsence.find({ tellerId }).sort({ startDate: -1 }).lean();

    res.json({
      success: true,
      absences,
    });
  } catch (err) {
    console.error("❌ Fetch absences error:", err);
    res.status(500).json({ message: "Failed to fetch absences" });
  }
});

/**
 * ✅ GET /api/schedule/check-absence/:dateStr
 * Check if teller is absent on a specific date
 * Can be called without auth for checking during schedule generation
 */
router.get("/check-absence/:tellerId/:dateStr", async (req, res) => {
  try {
    const { tellerId, dateStr } = req.params;

    // Get day of week for the date
    const dayOfWeek = new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
      weekday: "long",
    });

    // Check for exact date match or recurring absence on that day
    const absence = await PlannedAbsence.findOne({
      tellerId,
      $or: [
        // Exact date range match
        {
          startDate: { $lte: dateStr },
          endDate: { $gte: dateStr },
          isRecurring: false,
        },
        // Recurring absence on this day of week
        {
          isRecurring: true,
          daysOfWeek: dayOfWeek,
          startDate: { $lte: dateStr },
          endDate: { $gte: dateStr },
        },
      ],
    }).lean();

    res.json({
      success: true,
      isAbsent: !!absence,
      absence: absence || null,
      dayOfWeek,
    });
  } catch (err) {
    console.error("❌ Check absence error:", err);
    res.status(500).json({ message: "Failed to check absence" });
  }
});

/**
 * ✅ DELETE /api/schedule/cancel-absence/:absenceId
 * Cancel a planned absence
 */
router.delete("/cancel-absence/:absenceId", requireAuth, async (req, res) => {
  try {
    const { absenceId } = req.params;
    const tellerId = req.user._id;

    // Verify ownership
    const absence = await PlannedAbsence.findById(absenceId);
    if (!absence) {
      return res.status(404).json({ message: "Absence not found" });
    }

    if (absence.tellerId.toString() !== tellerId.toString()) {
      return res.status(403).json({ message: "Forbidden - not your absence" });
    }

    await PlannedAbsence.findByIdAndDelete(absenceId);
    console.log(`✅ Cancelled absence for ${absence.tellerName}`);

    res.json({
      success: true,
      message: "Absence cancelled successfully",
    });
  } catch (err) {
    console.error("❌ Cancel absence error:", err);
    res.status(500).json({ message: "Failed to cancel absence" });
  }
});

export default router;

