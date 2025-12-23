import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { useNavigate } from "react-router-dom";
import {
  User,
  Check,
  X,
  Clock,
  CalendarDays,
  RefreshCw,
  PlusCircle,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  RotateCcw,
  UserPlus,
  UserMinus,
  AlertTriangle,
  Award,
  Bot,
  Sparkles,
  Trash2,
} from "lucide-react";
import { getSocket } from "../socket";
import { getApiUrl } from "../utils/apiConfig";
import PlanAbsence from "../components/PlanAbsence";

export default function ScheduleRotation() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const dark = settings?.theme?.mode === "dark";
  
  // Get API URL fresh each time to avoid stale references
  const API = getApiUrl();

  const [tomorrowAssignments, setTomorrowAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tellerCount, setTellerCount] = useState(3);
  const [workDaysRange, setWorkDaysRange] = useState('week'); // 'week' | 'month' | 'year' | 'all'
  const [generating, setGenerating] = useState(false);
  
  // 🆕 Navigation for tomorrow's assignments
  const [currentAssignmentIndex, setCurrentAssignmentIndex] = useState(0);
  
  // 🆕 Date range filter for tomorrow's schedule
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [customRangeStart, setCustomRangeStart] = useState('');
  const [customRangeEnd, setCustomRangeEnd] = useState('');
  
  // Initialize default Monday-Sunday range
  useEffect(() => {
    // Calculate Monday and Sunday of current week
    const today = new Date();
    const day = today.getDay();
    const diff = (day + 6) % 7; // days since Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    setCustomRangeStart(monday.toISOString().slice(0, 10));
    setCustomRangeEnd(sunday.toISOString().slice(0, 10));
  }, []);

  // 🆕 Replacement modal & suggestions
  const [showModal, setShowModal] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // 🆕 Absent reason modal
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [absentReason, setAbsentReason] = useState("");
  const [penaltyDays, setPenaltyDays] = useState(0);

  // 🆕 Suggested tellers card
  const [suggestedTellers, setSuggestedTellers] = useState([]);
  const [allTellers, setAllTellers] = useState([]);
  // Full-week selection state
  const [weekStartKey, setWeekStartKey] = useState(null);
  const [fullWeekSelection, setFullWeekSelection] = useState(null);
  const [selectedFullWeekIds, setSelectedFullWeekIds] = useState([]);
  const [fullWeekCount, setFullWeekCount] = useState(0);
  const [previewPlanned, setPreviewPlanned] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [lastAuditId, setLastAuditId] = useState(null);

  // 🆕 Today's working tellers
  const [todayWorkingTellers, setTodayWorkingTellers] = useState([]);
  const [todayDate, setTodayDate] = useState(new Date().toISOString().slice(0, 10));

  const isAlfonsoUsername = (user?.username || "").toLowerCase().includes('alfonso');
  const isSupervisorOrAdmin =
    user?.role === "supervisor" || user?.role === "admin" || user?.role === "super_admin" || isAlfonsoUsername;

  const isAdminOnly = user?.role === "admin" || user?.role === "super_admin" || isAlfonsoUsername;
  const isSuperAdminOnly = user?.role === "admin" || user?.role === "super_admin" || isAlfonsoUsername;
  const isDeclaratorViewOnly = user?.role === "declarator";

  useEffect(() => {
    console.log("📅 useEffect triggered for todayDate:", todayDate);
    fetchData();
    fetchSuggestedTellers();
    if (isSupervisorOrAdmin) {
      fetchAllTellers();
    }
    fetchTodayWorkingTellers();
    // compute week start (Monday) for the week containing todayDate
    try {
      const d = new Date(todayDate);
      // get day (0 Sunday..6 Saturday); convert so Monday=0
      const day = d.getDay();
      const diff = (day + 6) % 7; // number of days since Monday
      const monday = new Date(d);
      monday.setDate(d.getDate() - diff);
      const wk = monday.toISOString().slice(0, 10);
      setWeekStartKey(wk);
    } catch (e) {
      console.warn('Failed to calculate week start', e.message);
    }
  }, [todayDate, workDaysRange, useCustomDateRange, customRangeStart]);

  // ✅ Real-time socket listener
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.on("scheduleUpdated", (update) => {
        console.log("🔄 Schedule update:", update);
        setTomorrowAssignments((prev) =>
          prev.map((t) =>
            t.tellerId === update.tellerId
              ? { ...t, status: update.status }
              : t
          )
        );
        showToast({
          type:
            update.status === "present"
              ? "success"
              : update.status === "absent"
              ? "warning"
              : "info",
          message: `${update.tellerName} marked ${update.status}`,
        });
      });

      return () => {
        socket.off("scheduleUpdated");
        socket.off("userPenaltyCleared");
      };
    }
  }, []);

  // Listen for penalty cleared events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (payload) => {
      console.log('🔁 Penalty cleared event received:', payload);
      // refresh list and schedule
      fetchAllTellers();
      fetchData();
    };
    socket.on('userPenaltyCleared', handler);
    return () => socket.off('userPenaltyCleared', handler);
  }, [weekStartKey]);

  // ✅ Fetch schedule data
  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      
      if (!token) {
        console.error('❌ No token found in localStorage');
        showToast({ type: "error", message: "Authentication required. Please log in again." });
        setLoading(false);
        return;
      }
      
      // If custom date range is enabled, fetch from that range
      if (useCustomDateRange && customRangeStart && customRangeEnd) {
        console.log('🔍 Fetching assignments for custom range:', customRangeStart, 'to', customRangeEnd);
        
        // Parse the date range
        const startDate = new Date(customRangeStart);
        const endDate = new Date(customRangeEnd);
        const allAssignments = [];
        
        // Fetch assignments for each day in the range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().slice(0, 10);
          try {
            const res = await axios.get(`${API}/api/schedule/by-date/${dateStr}`, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 30000
            });
            if (res.data.schedule && res.data.schedule.length > 0) {
              allAssignments.push(...res.data.schedule);
              console.log(`  ✅ ${dateStr}: ${res.data.schedule.length} assignments`);
            }
          } catch (err) {
            console.log(`  ⚠️ ${dateStr}: No data or error`, err.message);
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        console.log('🔍 Total assignments in range:', allAssignments.length);
        setTomorrowAssignments(allAssignments);
      } else {
        // Default: fetch tomorrow's schedule
        let queryStr = `?range=${workDaysRange}`;
        console.log('🔍 Fetching tomorrow schedule with query:', queryStr);
        const res = await axios.get(`${API}/api/schedule/tomorrow${queryStr}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000
        });
        console.log('🔍 /api/schedule/tomorrow response:', res.data?.schedule?.map(s=>({id:s._id,tellerName:s.tellerName,rangeWorkDays:s.rangeWorkDays,range:s.range})));
        setTomorrowAssignments(res.data.schedule || []);
      }
    } catch (err) {
      console.error("❌ Failed to fetch schedule:", err);
      
      // Show specific error message based on error type
      let errorMsg = "Failed to load schedule data.";
      
      if (err.response?.status === 401) {
        errorMsg = "Session expired. Please log in again.";
      } else if (err.response?.status === 403) {
        errorMsg = "Permission denied to view schedule.";
      } else if (err.response?.status === 500) {
        errorMsg = `Server error: ${err.response?.data?.message || 'Internal server error'}`;
      } else if (err.code === 'ECONNABORTED') {
        errorMsg = "Request timeout (30s). Backend might be slow.";
      } else if (err.code === 'ECONNREFUSED') {
        errorMsg = "Cannot connect to backend.";
      } else if (err.message) {
        errorMsg = `Error: ${err.message}`;
      }
      
      showToast({ type: "error", message: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch suggested tellers (visible card)
  const fetchSuggestedTellers = async (dateParam = null) => {
    try {
      // Fetch suggested tellers based on selected date
      let dateToFetch;
      if (useCustomDateRange && customRangeStart) {
        dateToFetch = customRangeStart;
      } else {
        const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
        dateToFetch = tomorrow.toISOString().slice(0, 10);
      }
      // Original tomorrow setup (now obsolete):
      // const tomorrow = new Date();
      // tomorrow.setDate(tomorrow.getDate() + 1);
      

      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/schedule/suggest/${dateToFetch}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuggestedTellers(res.data.suggestions || []);
    } catch (err) {
      console.error("❌ Failed to load suggested tellers:", err);
    }
  };

  // ✅ Fetch all tellers for directory
  const fetchAllTellers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter to only show tellers and supervisor_tellers
      const tellersOnly = res.data.filter(user =>
        user.role === 'teller' || user.role === 'supervisor_teller'
      );
      setAllTellers(tellersOnly || []);
    } catch (err) {
      console.error("❌ Failed to load all tellers:", err);
      setAllTellers([]);
    }
  };

  const removePenalty = async (tellerId) => {
    if (!window.confirm('Remove penalty for this teller now?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/admin/users/${tellerId}/remove-penalty`, {}, { headers: { Authorization: `Bearer ${token}` } });
      showToast({ type: 'success', message: 'Penalty removed' });
      // Refresh list and schedule
      await fetchAllTellers();
      await fetchData();
    } catch (err) {
      console.error('❌ Failed to remove penalty', err);
      showToast({ type: 'error', message: 'Failed to remove penalty' });
    }
  };

  // 🆕 Fetch today's working tellers based on submitted reports
  const fetchTodayWorkingTellers = async () => {
    try {
      console.log("🔍 Fetching working tellers for date:", todayDate);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/schedule/today-working/${todayDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("📊 Working tellers response:", res.data);
      setTodayWorkingTellers(res.data.tellers || []);
    } catch (err) {
      console.error("❌ Failed to load today's working tellers:", err);
      setTodayWorkingTellers([]);
    }
  };

  // ✅ Fetch saved full-week selection for the active week
  const fetchFullWeekSelection = async (weekKeyParam = weekStartKey) => {
    if (!weekKeyParam) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/schedule/full-week/${weekKeyParam}`, { headers: { Authorization: `Bearer ${token}` } });
      setFullWeekSelection(res.data.selection || null);
      if (res.data.selection) {
        setSelectedFullWeekIds((res.data.selection.tellerIds || []).map(t => t._id));
        setFullWeekCount(res.data.selection.count || (res.data.selection.tellerIds || []).length || 0);
      } else {
        setSelectedFullWeekIds([]);
        setFullWeekCount(0);
      }
    } catch (err) {
      console.error("❌ Failed to fetch full-week selection:", err);
    }
  };

  const handleGenerateTomorrow = async () => {
    if (!window.confirm("Generate tomorrow’s schedule now?")) return;
    try {
      setGenerating(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/schedule/tomorrow?range=${workDaysRange}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTomorrowAssignments(res.data.schedule || []);
      showToast({
        type: "success",
        message: "Tomorrow’s schedule generated successfully.",
      });
    } catch (err) {
      console.error("❌ Failed to generate tomorrow’s schedule:", err);
      showToast({
        type: "error",
        message: "Failed to generate tomorrow’s schedule.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSetTellerCount = async () => {
    if (tellerCount <= 0) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.put(`${API}/api/schedule/set-teller-count`, {
        tellerCount,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh assignments and suggested tellers using the selected range
      await fetchData();
      fetchSuggestedTellers(); // Refresh suggested tellers too
      
      showToast({
        type: "success",
        message: `Teller count updated to ${tellerCount}.`,
      });
    } catch (err) {
      console.error("Error updating teller count:", err);
      showToast({ type: "error", message: "Failed to update teller count." });
    }
  };

  // Toggle teller in full-week selection
  const handleToggleFullWeekTeller = (tellerId) => {
    setSelectedFullWeekIds(prev => {
      const exists = prev.includes(tellerId);
      if (exists) return prev.filter(id => id !== tellerId);
      // enforce limit if count > 0
      if (fullWeekCount > 0 && prev.length >= fullWeekCount) {
        // Prevent selecting more than configured fullWeekCount
        return prev;
      }
      return [...prev, tellerId];
    });
  };

  const saveFullWeekSelection = async () => {
    if (!weekStartKey) return showToast({ type: 'error', message: 'Week start not set' });
    try {
      const token = localStorage.getItem('token');
      const payload = { weekKey: weekStartKey, tellerIds: selectedFullWeekIds, count: fullWeekCount };
      // Apply immediately for the current week (from tomorrow through Sunday)
      await applyFullWeekSelection();
    } catch (err) {
      console.error('❌ Failed to save full-week selection', err);
      showToast({ type: 'error', message: 'Failed to save full-week selection' });
    }
  };

  const applyFullWeekSelection = async () => {
    if (!weekStartKey) return showToast({ type: 'error', message: 'Week start not set' });
    try {
      setApplying(true);
      const token = localStorage.getItem('token');
      const payload = { weekKey: weekStartKey, tellerIds: selectedFullWeekIds, count: fullWeekCount, confirmApply: true };
      const res = await axios.put(`${API}/api/schedule/full-week`, payload, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data && res.data.applied) {
        setLastAuditId(res.data.auditId || null);
        // Refresh state
        await fetchFullWeekSelection(weekStartKey);
        await fetchData();
        setShowPreviewModal(false);
        showToast({ type: 'success', message: 'Full-week applied. You can undo from the confirmation.' });
      } else {
        showToast({ type: 'error', message: 'Failed to apply full-week selection' });
      }
    } catch (err) {
      console.error('❌ Failed to apply full-week selection', err);
      showToast({ type: 'error', message: 'Failed to apply full-week selection' });
    } finally {
      setApplying(false);
    }
  };

  const undoFullWeekAudit = async (auditIdParam = lastAuditId) => {
    if (!auditIdParam) return showToast({ type: 'error', message: 'No audit to undo' });
    if (!window.confirm('Undo the last full-week application? This will attempt to revert assignments.')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/api/schedule/full-week/undo/${auditIdParam}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data && res.data.reverted) {
        await fetchData();
        showToast({ type: 'success', message: 'Undo completed successfully' });
        setLastAuditId(null);
      } else {
        showToast({ type: 'error', message: 'Failed to undo' });
      }
    } catch (err) {
      console.error('❌ Undo failed', err);
      showToast({ type: 'error', message: 'Undo failed' });
    }
  };

  const resetFullWeekSelection = async () => {
    if (!weekStartKey) return;
    if (!window.confirm('Reset full-week selection for this week?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/schedule/full-week/${weekStartKey}`, { headers: { Authorization: `Bearer ${token}` } });
      setFullWeekSelection(null);
      setSelectedFullWeekIds([]);
      setFullWeekCount(0);
      // Refresh tomorrow assignments
      await fetchData();
      showToast({ type: 'success', message: 'Full-week selection reset for this week' });
    } catch (err) {
      console.error('❌ Failed to reset full-week selection', err);
      showToast({ type: 'error', message: 'Failed to reset selection' });
    }
  };

  const removeFullWeekTeller = async (assignment) => {
    if (!assignment || !assignment.tellerId || !assignment.dayKey) return;
    if (!window.confirm(`Remove ${assignment.tellerName} from full-week assignments?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/api/schedule/full-week/teller/${assignment.tellerId}/${assignment.dayKey}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast({
        type: 'success',
        message: `${assignment.tellerName} removed from full-week`,
      });
      fetchData();
      fetchSuggestedTellers();
    } catch (err) {
      console.error('❌ Error removing full-week teller:', err);
      showToast({ type: 'error', message: 'Failed to remove from full-week.' });
    }
  };

  const handleReplaceTeller = async (assignment) => {
    setSelectedAssignment(assignment);
    setSuggestLoading(true);
    setShowModal(true);
    
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/schedule/suggest/${assignment.dayKey}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuggestions(res.data.suggestions || []);
    } catch (err) {
      console.error("? Error fetching replacement suggestions:", err);
      showToast({ type: "error", message: "Failed to load replacement suggestions." });
    } finally {
      setSuggestLoading(false);
    }
  };

  const markPresent = async (assignmentId) => {
    try {
      const assignment = tomorrowAssignments.find((a) => a._id === assignmentId);
      if (!assignment) return;

      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/schedule/mark-present/${assignmentId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast({ type: "success", message: "Marked teller as present." });
      fetchData();
      fetchSuggestedTellers();
    } catch (err) {
      console.error("❌ Error marking present:", err);
      showToast({ type: "error", message: "Failed to mark present." });
    }
  };

  const handleAbsentClick = (assignment) => {
    setSelectedAssignment(assignment);
    setAbsentReason("");
    setPenaltyDays(0);
    setShowAbsentModal(true);
  };

  // Fetch full-week selection whenever weekStartKey or allTellers updates
  useEffect(() => {
    if (weekStartKey && allTellers.length) fetchFullWeekSelection(weekStartKey);
  }, [weekStartKey, allTellers]);

  const confirmAbsent = async () => {
    if (!selectedAssignment) return;
    if (!absentReason) {
      showToast({ type: "warning", message: "Please select an absent reason." });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/schedule/mark-absent`, {
        tellerId: selectedAssignment.tellerId,
        tellerName: selectedAssignment.tellerName,
        dayKey: selectedAssignment.dayKey,
        reason: absentReason,
        penaltyDays: penaltyDays,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showToast({
        type: "success",
        message: `${selectedAssignment.tellerName} marked absent${penaltyDays > 0 ? ` with ${penaltyDays} day penalty` : ""}.`,
      });

      setShowAbsentModal(false);
      
      // Now show replacement suggestions
      setSuggestLoading(true);
      setShowModal(true);
      
      const res = await axios.get(`${API}/api/schedule/suggest/${selectedAssignment.dayKey}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuggestions(res.data.suggestions || []);
      setSuggestLoading(false);
      
      fetchData();
      fetchSuggestedTellers();
    } catch (err) {
      console.error("❌ Error marking absent:", err);
      showToast({ type: "error", message: "Failed to mark absent." });
      setSuggestLoading(false);
    }
  };

  const handleReplace = async (replacementId) => {
    if (!selectedAssignment) return;
    if (!window.confirm("Assign this teller as replacement?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/schedule/replace/${selectedAssignment._id}`, {
        replacementId,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast({
        type: "success",
        message: "Replacement teller assigned successfully.",
      });
      setShowModal(false);
      fetchData();
      fetchSuggestedTellers();
    } catch (err) {
      console.error("❌ Error assigning replacement:", err);
      showToast({ type: "error", message: "Failed to assign replacement." });
    }
  };

  const markAbsent = (assignmentId) => {
    const assignment = tomorrowAssignments.find((a) => a._id === assignmentId);
    if (assignment) {
      handleAbsentClick(assignment);
    }
  };

  const removeAssignment = async (assignmentId) => {
    if (!window.confirm("Are you sure you want to remove this assignment?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/schedule/assignment/${assignmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast({
        type: "success",
        message: "Assignment removed successfully.",
      });
      fetchData();
      fetchSuggestedTellers();
    } catch (err) {
      console.error("❌ Error removing assignment:", err);
      showToast({ type: "error", message: "Failed to remove assignment." });
    }
  };

  // 🆕 No filter - show all assignments
  const filteredAssignments = Array.isArray(tomorrowAssignments) ? tomorrowAssignments : [];

  // 🆕 Get current assignment
  const currentAssignment = filteredAssignments[currentAssignmentIndex] || null;

  // 🆕 Filter suggestions to exclude tellers already assigned to tomorrow
  let filteredSuggestions = [];
  try {
    if (Array.isArray(suggestions) && Array.isArray(filteredAssignments)) {
      const assignedIds = new Set(
        filteredAssignments
          .map(a => a?.tellerId)
          .filter(Boolean)
          .map(id => String(id))
      );
      filteredSuggestions = suggestions.filter(teller => {
        if (!teller?._id) return false;
        return !assignedIds.has(String(teller._id));
      });
    }
  } catch (err) {
    console.error("Error filtering suggestions:", err);
    filteredSuggestions = suggestions || [];
  }

  return (
    <div
      className={`p-6 min-h-screen ${
        dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-indigo-500" />
            Teller Schedule Rotation
          </h1>
          <p className="text-sm opacity-70">
            Manage tomorrow’s teller assignments and track attendance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(user?.role === "supervisor" || user?.role === "admin" || user?.role === "super_admin") && (
            <button
              onClick={() => navigate("/attendance-scheduler")}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Bot className="w-4 h-4" />
              AI Attendance Scheduler
            </button>
          )}
          {(user?.role === "admin" || user?.role === "super_admin") && (
            <button
              onClick={handleGenerateTomorrow}
              disabled={generating}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                generating
                  ? "bg-gray-500 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              {generating ? "Generating..." : "Generate Tomorrow"}
            </button>
          )}
          <button
            onClick={() => {
              fetchData();
              fetchSuggestedTellers();
              if (isAdminOnly) {
                fetchAllTellers();
              }
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:opacity-90"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Plan Absence Section */}
      <div className="mb-8">
        <PlanAbsence />
      </div>

            {/* Tomorrow’s Schedule */}
      <div
        className={`rounded-lg shadow p-4 mb-8 ${
          dark ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newDate = new Date(useCustomDateRange && customRangeStart ? customRangeStart : new Date());
                newDate.setDate(newDate.getDate() - 1);
                const newDateStr = newDate.toISOString().slice(0, 10);
                setUseCustomDateRange(true);
                setCustomRangeStart(newDateStr);
                setCustomRangeEnd(newDateStr);
              }}
              className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:opacity-90"
            >
              ? Previous Day
            </button>
            
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" /> 
              {useCustomDateRange && customRangeStart ? 
                `Assignments for ${new Date(customRangeStart).toLocaleDateString()}` 
                : "Tomorrow's Assignments"}
            </h2>
            
            <button
              onClick={() => {
                const newDate = new Date(useCustomDateRange && customRangeEnd ? customRangeEnd : new Date());
                newDate.setDate(newDate.getDate() + 1);
                const newDateStr = newDate.toISOString().slice(0, 10);
                setUseCustomDateRange(true);
                setCustomRangeStart(newDateStr);
                setCustomRangeEnd(newDateStr);
              }}
              className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:opacity-90"
            >
              Next Day ?
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-400">Filter by date range:</label>
            
            {/* Toggle between predefined and custom range */}
            <button
              onClick={() => setUseCustomDateRange(!useCustomDateRange)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${
                useCustomDateRange
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
              }`}
            >
              {useCustomDateRange ? 'Custom Range' : 'Use Custom'}
            </button>

            {!useCustomDateRange ? (
              <select
                value={workDaysRange}
                onChange={(e) => setWorkDaysRange(e.target.value)}
                className={`text-sm p-2 rounded-lg border ${dark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200'}`}
              >
                <option value="week">Week (Mon-Sun)</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
                <option value="all">All-time</option>
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customRangeStart}
                  onChange={(e) => setCustomRangeStart(e.target.value)}
                  className={`text-sm p-2 rounded-lg border ${dark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200'}`}
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={customRangeEnd}
                  onChange={(e) => setCustomRangeEnd(e.target.value)}
                  className={`text-sm p-2 rounded-lg border ${dark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200'}`}
                />
              </div>
            )}
          </div>
        </div>

        {/* 🆕 Navigation Controls (Filter Removed) */}
        <div className={`mb-6 p-4 rounded-lg ${dark ? "bg-gray-700" : "bg-gray-50"}`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Status Filter - REMOVED */}

            {/* Navigation Buttons - ALWAYS SHOW */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentAssignmentIndex(Math.max(0, currentAssignmentIndex - 1))}
                disabled={currentAssignmentIndex === 0 || tomorrowAssignments.length === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  currentAssignmentIndex === 0 || tomorrowAssignments.length === 0
                    ? 'opacity-50 cursor-not-allowed'
                    : dark
                    ? 'bg-gray-600 hover:bg-gray-500 text-white'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              >
                ← Previous
              </button>
              <span className={`text-sm font-semibold px-3 py-1 rounded-lg ${dark ? 'bg-gray-600' : 'bg-gray-200'}`}>
                {tomorrowAssignments.length === 0 ? '0 of 0' : `${currentAssignmentIndex + 1} of ${filteredAssignments.length}`}
              </span>
              <button
                onClick={() => setCurrentAssignmentIndex(Math.min(filteredAssignments.length - 1, currentAssignmentIndex + 1))}
                disabled={currentAssignmentIndex >= filteredAssignments.length - 1 || tomorrowAssignments.length === 0}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  currentAssignmentIndex >= filteredAssignments.length - 1 || tomorrowAssignments.length === 0
                    ? 'opacity-50 cursor-not-allowed'
                    : dark
                    ? 'bg-gray-600 hover:bg-gray-500 text-white'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-6">Loading...</div>
        ) : tomorrowAssignments.length === 0 ? (
          <div className="text-center text-gray-400 py-6">
            No teller assignments found.
          </div>
        ) : !currentAssignment ? (
          <div className="text-center text-gray-400 py-6">
            No assignment to display.
          </div>
        ) : (
          <div className={`p-4 rounded-lg ${dark ? "bg-gray-800" : "bg-white"}`}>
            {/* Current Assignment Details */}
            <div className="mb-6 p-4 rounded-lg border-2 border-indigo-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold">{currentAssignment.tellerName || 'Unknown'}</h3>
                  <p className={`text-sm mt-2 ${
                    currentAssignment.status === 'present'
                      ? 'text-green-500'
                      : currentAssignment.status === 'absent'
                      ? 'text-red-500'
                      : 'text-yellow-500'
                  }`}>
                    Status: <span className="font-semibold">{(currentAssignment.status || 'pending').toUpperCase()}</span>
                  </p>
                  <p className="text-sm mt-1 text-gray-400">
                    Days Worked: <span className="font-semibold">{currentAssignment.rangeWorkDays || 0} days</span>
                  </p>
                </div>
                {!isDeclaratorViewOnly && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => markPresent(currentAssignment._id)}
                      className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-green-600 text-white hover:opacity-90"
                    >
                      <CheckCircle className="w-4 h-4" /> Present
                    </button>
                    {isSuperAdminOnly && (
                      <>
                        <button
                          onClick={() => handleReplaceTeller(currentAssignment)}
                          className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:opacity-90"
                        >
                          <Check className="w-4 h-4" /> Replace
                        </button>
                        <button
                          onClick={() => markAbsent(currentAssignment._id)}
                          className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-red-600 text-white hover:opacity-90"
                        >
                          <X className="w-4 h-4" /> Absent
                        </button>
                        <button
                          onClick={() => removeAssignment(currentAssignment._id)}
                          className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-orange-600 text-white hover:opacity-90"
                        >
                          <Trash2 className="w-4 h-4" /> Remove
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* All Assignments Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead
                  className={`${dark ? "bg-gray-700" : "bg-gray-100"} text-left`}
                >
                  <tr>
                    <th className="p-3">Teller</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">
                      Days Worked
                      <span className="text-xs text-gray-500 font-normal ml-1">
                        ({useCustomDateRange ? `${customRangeStart} to ${customRangeEnd}` : (workDaysRange === 'week' ? 'Mon-Sun' : workDaysRange === 'month' ? 'This month' : workDaysRange === 'year' ? 'This year' : 'All-time')})
                      </span>
                    </th>
                    {!isDeclaratorViewOnly && isAdminOnly && <th className="p-3 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((a, idx) => (
                    <tr
                      key={a._id}
                      onClick={() => setCurrentAssignmentIndex(idx)}
                      className={`cursor-pointer transition ${
                        idx === currentAssignmentIndex
                          ? dark
                            ? 'bg-indigo-900/50 border-l-4 border-indigo-500'
                            : 'bg-indigo-50 border-l-4 border-indigo-500'
                          : dark
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{a.tellerName}</span>
                          {a.isFullWeek && (
                            <div className="flex items-center gap-1 ml-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                Full-week
                              </span>
                              {isSuperAdminOnly && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFullWeekTeller(a);
                                  }}
                                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-200 hover:bg-indigo-300 text-indigo-700 transition"
                                  title="Remove from full-week"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          a.status === 'present'
                            ? 'bg-green-100 text-green-800'
                            : a.status === 'absent'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {(a.status || 'pending').charAt(0).toUpperCase() + (a.status || 'pending').slice(1)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {typeof a.rangeWorkDays !== 'undefined' ? a.rangeWorkDays : (a.totalWorkDays || 0)} days
                        </span>
                      </td>
                      {!isDeclaratorViewOnly && isAdminOnly && (
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markPresent(a._id);
                              }}
                              className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-green-600 text-white hover:opacity-90"
                            >
                              <CheckCircle className="w-3 h-3" /> Present
                            </button>
                            {isSuperAdminOnly && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReplaceTeller(a);
                                  }}
                                  className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-blue-600 text-white hover:opacity-90"
                                >
                                  <Check className="w-3 h-3" /> Replace
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAbsent(a._id);
                                  }}
                                  className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-red-600 text-white hover:opacity-90"
                                >
                                  <X className="w-3 h-3" /> Absent
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeAssignment(a._id);
                                  }}
                                  className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-orange-600 text-white hover:opacity-90"
                                >
                                  <Trash2 className="w-3 h-3" /> Remove
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 🆕 Today's Working Tellers */}
      <div
        className={`p-4 mb-6 rounded-xl ${
          dark ? "bg-gray-800" : "bg-white"
        } shadow-sm`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Today's Working Tellers ({todayDate})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newDate = new Date(todayDate);
                newDate.setDate(newDate.getDate() - 1);
                const newDateStr = newDate.toISOString().slice(0, 10);
                console.log("⬅️ Previous Day clicked, setting date to:", newDateStr);
                setTodayDate(newDateStr);
              }}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:opacity-90"
            >
              ← Previous Day
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const todayStr = today.toISOString().slice(0, 10);
                console.log("🏠 Today clicked, setting date to:", todayStr);
                setTodayDate(todayStr);
              }}
              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-lg hover:opacity-90"
            >
              Today
            </button>
            <button
              onClick={() => {
                const newDate = new Date(todayDate);
                newDate.setDate(newDate.getDate() + 1);
                const newDateStr = newDate.toISOString().slice(0, 10);
                console.log("➡️ Next Day clicked, setting date to:", newDateStr);
                setTodayDate(newDateStr);
              }}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:opacity-90"
            >
              Next Day →
            </button>
            <button
              onClick={fetchTodayWorkingTellers}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:opacity-90"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        {todayWorkingTellers.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            No tellers have submitted reports for {new Date(todayDate).toLocaleDateString()} yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayWorkingTellers.map((teller) => (
              <div
                key={teller._id}
                className={`p-3 rounded-lg border ${
                  dark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold">{teller.name}</p>
                    <p className="text-xs text-gray-500">{teller.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teller Count */}
      <div
        className={`p-4 mb-6 rounded-xl ${
          dark ? "bg-gray-800" : "bg-white"
        } flex flex-col sm:flex-row items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            Number of tellers for tomorrow:
          </span>
          {isAdminOnly ? (
            <input
              type="number"
              min={1}
              value={tellerCount}
              onChange={(e) => setTellerCount(Number(e.target.value))}
              className={`w-20 text-center p-2 rounded-lg border ${
                dark
                  ? "bg-gray-700 border-gray-600 text-gray-100"
                  : "bg-gray-50 border-gray-200"
              }`}
            />
          ) : (
            <span className="w-20 text-center p-2 rounded-lg border bg-gray-100 text-gray-600">
              {tellerCount}
            </span>
          )}
        </div>
        {isAdminOnly && (
          <button
            onClick={handleSetTellerCount}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:opacity-90"
          >
            Update Count
          </button>
        )}
      </div>

      {/* 🆕 All Tellers Directory */}
      {/* 🆕 Full-week Selection */}
      {isAdminOnly && (
        <div className={`rounded-lg shadow p-4 mb-8 ${dark ? "bg-gray-800" : "bg-white"}`}>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" /> Full-week Tellers
          </h2>

          <div className="mb-3 text-sm text-gray-400">
            Week starting: <strong>{weekStartKey || '—'}</strong>
          </div>

          <div className="flex gap-3 items-center mb-4">
            <label className="text-sm text-gray-400">Number who will work full week:</label>
            <input
              type="number"
              min={0}
              value={fullWeekCount}
              onChange={(e) => setFullWeekCount(Number(e.target.value))}
              className={`w-20 p-2 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`}
            />
            <button
              onClick={saveFullWeekSelection}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:opacity-90"
            >Save</button>
            <button
              onClick={resetFullWeekSelection}
              className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            >Reset</button>
          </div>

          <div className="text-sm text-gray-400 mb-3">Select tellers who will work for the entire week (selection limited by the number above)</div>

          {allTellers.length === 0 ? (
            <div className="text-center text-gray-400 py-4">No tellers available to select.</div>
          ) : (
            <ul className="divide-y divide-gray-200 max-h-72 overflow-y-auto">
              {allTellers.map((t) => (
                <li key={t._id} className={`flex items-center justify-between py-2 ${dark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                  <div>
                    <p className="font-semibold">{t.name || t.username}</p>
                    <p className="text-xs text-gray-500">Last worked: {t.lastWorked ? new Date(t.lastWorked).toLocaleDateString() : 'Never'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedFullWeekIds.includes(t._id)}
                      disabled={!selectedFullWeekIds.includes(t._id) && fullWeekCount > 0 && selectedFullWeekIds.length >= fullWeekCount}
                      onChange={() => handleToggleFullWeekTeller(t._id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {isSupervisorOrAdmin && (
        <div
          className={`rounded-lg shadow p-4 mb-8 ${
            dark ? "bg-gray-800" : "bg-white"
          }`}
        >
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" /> All Tellers Directory
          </h2>
          {allTellers.length === 0 ? (
            <div className="text-center text-gray-400 py-4">No tellers found.</div>
          ) : (
            <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {allTellers.map((teller) => (
                <li
                  key={teller._id}
                  className={`flex justify-between items-center py-3 ${
                    dark ? "hover:bg-gray-700" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-semibold">{teller.name || teller.username}</p>
                    <div className="flex gap-3 text-xs mt-1">
                      <span className="text-gray-500">
                        Last Worked: {teller.lastWorked ? new Date(teller.lastWorked).toLocaleDateString() : "Never"}
                      </span>
                      <span className="text-indigo-600 font-medium">
                        Total Days: {teller.totalWorkDays || 0}
                      </span>
                    </div>
                    {teller.skipUntil && new Date(teller.skipUntil) > new Date() && (
                      <p className="text-xs text-red-500 mt-1">
                        ⚠️ Penalty until: {new Date(teller.skipUntil).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 text-xs rounded-full ${
                        teller.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : teller.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {teller.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {teller.role === 'supervisor_teller' ? 'Supervisor' : 'Teller'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 🆕 Absent Reason Modal */}
      {showAbsentModal && isAdminOnly && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div
            className={`rounded-2xl shadow-lg p-6 w-full max-w-md ${
              dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
            }`}
          >
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <X className="w-5 h-5 text-red-500" />
              Mark Teller Absent
            </h2>

            <div className="mb-4">
              <p className="text-sm mb-2">
                Marking <span className="font-semibold">{selectedAssignment?.tellerName}</span> as absent
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Reason for Absence <span className="text-red-500">*</span>
              </label>
              <select
                value={absentReason}
                onChange={(e) => setAbsentReason(e.target.value)}
                className={`w-full p-2 border rounded-lg ${
                  dark
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300"
                }`}
              >
                <option value="">-- Select Reason --</option>
                <option value="Sick">Sick</option>
                <option value="Emergency">Emergency</option>
                <option value="Personal">Personal Leave</option>
                <option value="Family Matter">Family Matter</option>
                <option value="NCNS">No Call No Show (NCNS)</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Penalty (Skip Work Days)
              </label>
              <select
                value={penaltyDays}
                onChange={(e) => setPenaltyDays(parseInt(e.target.value))}
                className={`w-full p-2 border rounded-lg ${
                  dark
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300"
                }`}
              >
                <option value={0}>No Penalty</option>
                <option value={1}>1 Day</option>
                <option value={3}>3 Days</option>
                <option value={5}>5 Days</option>
                <option value={7}>7 Days (1 Week)</option>
                <option value={14}>14 Days (2 Weeks)</option>
              </select>
              {penaltyDays > 0 && (
                <p className="text-xs text-orange-500 mt-1">
                  ⚠️ Teller will be skipped from schedule for {penaltyDays} day(s)
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAbsentModal(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-500 text-white hover:opacity-90"
              >
                Cancel
              </button>
              <button
                onClick={confirmAbsent}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Confirm Absent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 Replacement Modal */}
      {showModal && isAdminOnly && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div
            className={`rounded-2xl shadow-lg p-6 w-full max-w-2xl ${
              dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
            }`}
          >
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-indigo-500" />
              Suggested Replacement Tellers
            </h2>

            {suggestLoading ? (
              <div className="text-center py-4 text-gray-400">Loading...</div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="text-center py-4 text-gray-400">
                No available tellers to suggest.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {filteredSuggestions.map((teller) => (
                  <li
                    key={teller._id}
                    className={`py-4 ${dark ? "hover:bg-gray-700" : "hover:bg-gray-50"}`}
                  >
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{teller.name || teller.username}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Total days worked (this week): <strong>{teller.weeklyWorkedDays || 0}</strong>
                        </p>
                      </div>
                      <button
                        onClick={() => handleReplace(teller._id)}
                        className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700 whitespace-nowrap"
                      >
                        Select
                      </button>
                    </div>

                    {/* Daily breakdown */}
                    {teller.dailyWorkedDays && (
                      <div className="mt-2 bg-gray-100/50 dark:bg-gray-700/30 rounded p-2">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Days breakdown (Mon-Sun):</p>
                        <div className="grid grid-cols-7 gap-1">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                            <div key={day} className="text-center">
                              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                {day.slice(0, 3)}
                              </div>
                              <div className={`text-xs font-bold rounded py-1 ${
                                teller.dailyWorkedDays[day] > 0
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                              }`}>
                                {teller.dailyWorkedDays[day] || 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Last worked and penalty info */}
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {teller.lastWorked && (
                        <span>Last Worked: {new Date(teller.lastWorked).toLocaleDateString()}</span>
                      )}
                    </div>

                    {teller.skipUntil && (
                      <div className="flex items-center gap-3 mt-2">
                        <p className="text-xs text-red-500">⚠️ Penalty until: {new Date(teller.skipUntil).toLocaleDateString()}</p>
                        {isAdminOnly && (
                          <button onClick={() => removePenalty(teller._id)} className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:opacity-90">Remove Penalty</button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 text-right">
              <button
                onClick={() => setShowModal(false)}
                className="text-sm px-4 py-2 rounded-lg bg-gray-500 text-white hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 Full-week Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className={`rounded-2xl shadow-lg p-6 w-full max-w-3xl ${dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"}`}>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-indigo-500" /> Full-week changes preview
            </h2>

            <div className="max-h-96 overflow-y-auto">
              {previewPlanned.length === 0 ? (
                <div className="text-center py-6 text-gray-400">No changes planned for this week.</div>
              ) : (
                previewPlanned.map((p) => (
                  <div key={p.dayKey} className="mb-4 border rounded p-3">
                    <div className="font-semibold mb-2">Day: {p.dayKey}</div>
                    {p.replacements && p.replacements.length > 0 && (
                      <div className="mb-2">
                        <div className="text-sm font-medium">Replacements</div>
                        <ul className="mt-2 space-y-1 text-sm">
                          {p.replacements.map((r, idx) => (
                            <li key={idx} className="flex items-center justify-between">
                              <div>{r.from?.name || r.from?.id} → <strong>{(allTellers.find(t=>t._id===r.to.id)?.name) || r.to.id}</strong></div>
                              <div className="text-xs text-gray-400">assignmentId: {r.assignmentId}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {p.appends && p.appends.length > 0 && (
                      <div>
                        <div className="text-sm font-medium">Appends</div>
                        <ul className="mt-2 text-sm">
                          {p.appends.map((a, idx) => (
                            <li key={idx} className="flex items-center justify-between">
                              <div><strong>{(allTellers.find(t=>t._id===a.to.id)?.name) || a.to.id}</strong> will be appended</div>
                              <div className="text-xs text-gray-400">day: {a.dayKey}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              {lastAuditId && (
                <button onClick={() => undoFullWeekAudit()} className="px-3 py-2 rounded-lg bg-yellow-500 text-white">Undo last</button>
              )}
              <button onClick={() => setShowPreviewModal(false)} className="px-3 py-2 rounded-lg bg-gray-500 text-white">Cancel</button>
              <button onClick={applyFullWeekSelection} disabled={applying} className="px-3 py-2 rounded-lg bg-indigo-600 text-white">{applying ? 'Applying...' : 'Confirm & Apply'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





