// backend/routes/attendance.js
import express from "express";
import { DateTime } from "luxon";
import DailyAttendance from "../models/DailyAttendance.js";
import User from "../models/User.js";
import DailyTellerAssignment from "../models/DailyTellerAssignment.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Utility: Format date as yyyy-MM-dd (Asia/Manila timezone)
 */
const formatDate = (offsetDays = 0) => {
  return DateTime.now().setZone("Asia/Manila").plus({ days: offsetDays }).toFormat("yyyy-MM-dd");
};

/**
 * 📊 GET /api/attendance/tellers
 * Get all active tellers for attendance marking
 */
router.get("/tellers", protect, async (req, res) => {
  try {
    const tellers = await User.find({ 
      role: "teller", 
      isActive: { $ne: false } 
    }).select("username name email").sort({ name: 1 });

    res.json({ 
      success: true, 
      tellers,
      total: tellers.length 
    });
  } catch (err) {
    console.error("❌ Failed to fetch tellers:", err);
    res.status(500).json({ message: "Failed to fetch tellers" });
  }
});

/**
 * 📅 GET /api/attendance/today
 * Get today's attendance record
 */
router.get("/today", protect, async (req, res) => {
  try {
    const today = formatDate(0);
    
    const attendance = await DailyAttendance.findOne({ date: today })
      .populate('presentTellers.userId', 'username name')
      .populate('absentTellers.userId', 'username name')
      .populate('markedBy', 'username name');

    if (!attendance) {
      return res.json({ 
        success: true, 
        attendance: null, 
        date: today,
        message: "No attendance marked for today" 
      });
    }

    res.json({ 
      success: true, 
      attendance,
      date: today 
    });
  } catch (err) {
    console.error("❌ Failed to fetch today's attendance:", err);
    res.status(500).json({ message: "Failed to fetch attendance" });
  }
});

/**
 * ✏️ POST /api/attendance/mark
 * Mark attendance for the day
 */
router.post("/mark", protect, async (req, res) => {
  try {
    const { presentTellerIds, absentTellers, date: requestDate } = req.body;
    const supervisorId = req.user.userId;

    // Use provided date or default to today
    const targetDate = requestDate || formatDate(0);

    // Validate supervisor role
    const supervisor = await User.findById(supervisorId);
    if (!supervisor || !['supervisor', 'admin'].includes(supervisor.role)) {
      return res.status(403).json({ message: "Only supervisors can mark attendance" });
    }

    // Get all active tellers
    const allTellers = await User.find({ 
      role: "teller", 
      isActive: { $ne: false } 
    }).select("username name");

    // Validate teller IDs
    const validTellerIds = allTellers.map(t => t._id.toString());
    const invalidIds = presentTellerIds.filter(id => !validTellerIds.includes(id));
    
    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        message: "Invalid teller IDs provided", 
        invalidIds 
      });
    }

    // Prepare present tellers data
    const presentTellers = presentTellerIds.map(id => {
      const teller = allTellers.find(t => t._id.toString() === id);
      return {
        userId: teller._id,
        username: teller.username,
        name: teller.name,
        markedAt: new Date()
      };
    });

    // Prepare absent tellers data
    const absentTellerData = (absentTellers || []).map(absent => {
      const teller = allTellers.find(t => t._id.toString() === absent.userId);
      return {
        userId: teller._id,
        username: teller.username,
        name: teller.name,
        reason: absent.reason || 'no-show',
        note: absent.note || '',
        markedAt: new Date()
      };
    });

    // Create or update attendance record
    const attendanceData = {
      date: targetDate,
      presentTellers,
      absentTellers: absentTellerData,
      markedBy: supervisorId,
      totalTellers: allTellers.length
    };

    const attendance = await DailyAttendance.findOneAndUpdate(
      { date: targetDate },
      attendanceData,
      { upsert: true, new: true }
    ).populate('markedBy', 'username name');

    console.log(`📊 Attendance marked for ${targetDate}:`, {
      present: presentTellers.length,
      absent: absentTellerData.length,
      total: allTellers.length,
      rate: attendance.attendanceRate
    });

    res.json({ 
      success: true, 
      attendance,
      message: `Attendance marked for ${targetDate}`,
      stats: {
        present: presentTellers.length,
        absent: absentTellerData.length,
        total: allTellers.length,
        attendanceRate: attendance.attendanceRate
      }
    });
  } catch (err) {
    console.error("❌ Failed to mark attendance:", err);
    res.status(500).json({ message: "Failed to mark attendance" });
  }
});

/**
 * 📈 GET /api/attendance/history
 * Get attendance history with pagination
 */
router.get("/history", protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      };
    }

    const [attendance, total] = await Promise.all([
      DailyAttendance.find(dateFilter)
        .populate('markedBy', 'username name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DailyAttendance.countDocuments(dateFilter)
    ]);

    res.json({ 
      success: true, 
      attendance,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        hasNext: skip + attendance.length < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error("❌ Failed to fetch attendance history:", err);
    res.status(500).json({ message: "Failed to fetch attendance history" });
  }
});

/**
 * 🤖 GET /api/attendance/suggestions
 * Get AI suggestions for fair teller assignments based on attendance
 */
router.get("/suggestions", protect, async (req, res) => {
  try {
    const { date, requiredCount = 3 } = req.query;
    const targetDate = date || formatDate(1); // Default to tomorrow

    // Get today's attendance to know who's available
    const todayAttendance = await DailyAttendance.findOne({ 
      date: formatDate(0) 
    });

    if (!todayAttendance || !todayAttendance.presentTellers.length) {
      return res.json({
        success: false,
        message: "No attendance record for today. Please mark attendance first.",
        suggestions: []
      });
    }

    // Get assignment history for fairness calculation
    const assignmentHistory = await DailyTellerAssignment.find({
      dayKey: { $gte: formatDate(-30) } // Last 30 days
    }).sort({ dayKey: -1 });

    // Calculate assignment frequency for each present teller
    const tellerStats = {};
    const presentTellerIds = todayAttendance.presentTellers.map(t => t.userId.toString());

    presentTellerIds.forEach(tellerId => {
      const teller = todayAttendance.presentTellers.find(t => t.userId.toString() === tellerId);
      tellerStats[tellerId] = {
        userId: tellerId,
        username: teller.username,
        name: teller.name,
        recentAssignments: 0,
        lastAssigned: null,
        priority: 0
      };
    });

    // Count recent assignments
    assignmentHistory.forEach(assignment => {
      if (tellerStats[assignment.tellerId]) {
        tellerStats[assignment.tellerId].recentAssignments++;
        if (!tellerStats[assignment.tellerId].lastAssigned || 
            assignment.dayKey > tellerStats[assignment.tellerId].lastAssigned) {
          tellerStats[assignment.tellerId].lastAssigned = assignment.dayKey;
        }
      }
    });

    // Calculate priority scores (lower assignments = higher priority)
    const maxAssignments = Math.max(...Object.values(tellerStats).map(t => t.recentAssignments));
    Object.values(tellerStats).forEach(teller => {
      teller.priority = maxAssignments - teller.recentAssignments;
      
      // Bonus priority for those who haven't been assigned recently
      if (!teller.lastAssigned || 
          DateTime.fromISO(teller.lastAssigned).diffNow('days').days < -7) {
        teller.priority += 5;
      }
    });

    // Sort by priority (highest first) and select top candidates
    const suggestions = Object.values(tellerStats)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, Math.min(requiredCount, presentTellerIds.length))
      .map((teller, index) => ({
        ...teller,
        rank: index + 1,
        reason: `${teller.recentAssignments} recent assignments, priority score: ${teller.priority}`
      }));

    console.log(`🤖 Generated ${suggestions.length} AI suggestions for ${targetDate}`);

    res.json({ 
      success: true, 
      suggestions,
      attendanceDate: formatDate(0),
      targetDate,
      availableTellers: presentTellerIds.length,
      requiredCount: parseInt(requiredCount)
    });
  } catch (err) {
    console.error("❌ Failed to generate suggestions:", err);
    res.status(500).json({ message: "Failed to generate suggestions" });
  }
});

export default router;