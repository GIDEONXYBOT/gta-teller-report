import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import {
  Users,
  Check,
  X,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  TrendingUp,
  Bot,
  Sparkles,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw
} from "lucide-react";

export default function AttendanceScheduler() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";
  
  // Get API URL fresh each time to avoid stale references
  const API = getApiUrl();

  // State management
  const [tellers, setTellers] = useState([]);
  const [selectedTellers, setSelectedTellers] = useState([]);
  const [absentTellers, setAbsentTellers] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [aiSchedule, setAiSchedule] = useState([]);
  const [showAiModal, setShowAiModal] = useState(false);

  const currentDate = new Date().toLocaleDateString();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString();

  // Fetch all tellers and today's attendance
  useEffect(() => {
    fetchTellers();
    fetchTodayAttendance();
  }, []);

  const fetchTellers = async () => {
    try {
      const response = await axios.get(`${API}/api/attendance/tellers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setTellers(response.data.tellers);
    } catch (error) {
      showToast("Failed to fetch tellers", "error");
      console.error("Error fetching tellers:", error);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const response = await axios.get(`${API}/api/attendance/today`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      if (response.data.attendance) {
        setAttendance(response.data.attendance);
        setSelectedTellers(response.data.attendance.presentTellers.map(t => t.userId));
        setAbsentTellers(response.data.attendance.absentTellers);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const handleTellerToggle = (tellerId) => {
    setSelectedTellers(prev => {
      if (prev.includes(tellerId)) {
        return prev.filter(id => id !== tellerId);
      } else {
        // Remove from absent list if being marked present
        setAbsentTellers(prev => prev.filter(t => t.userId !== tellerId));
        return [...prev, tellerId];
      }
    });
  };

  const markAbsent = (tellerId, reason = 'no-show', note = '') => {
    const teller = tellers.find(t => t._id === tellerId);
    if (!teller) return;

    // Remove from present list
    setSelectedTellers(prev => prev.filter(id => id !== tellerId));
    
    // Add to absent list
    setAbsentTellers(prev => {
      const filtered = prev.filter(t => t.userId !== tellerId);
      return [...filtered, { userId: tellerId, reason, note }];
    });
  };

  const submitAttendance = async () => {
    if (!selectedTellers.length) {
      showToast("Please select at least one teller as present", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/attendance/mark`, {
        presentTellerIds: selectedTellers,
        absentTellers: absentTellers
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });

      setAttendance(response.data.attendance);
      showToast(`Attendance marked: ${response.data.stats.present}/${response.data.stats.total} present`, "success");
      
    } catch (error) {
      showToast("Failed to mark attendance", "error");
      console.error("Error marking attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateAiSchedule = async () => {
    if (!attendance || !attendance.presentTellers.length) {
      showToast("Please mark attendance first", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/schedule/ai-generate`, {
        requiredCount: 3,
        forceRegenerate: true
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });

      setAiSchedule(response.data.schedule);
      setSuggestions(response.data.alternatives || []);
      setShowAiModal(true);
      
      showToast(`AI schedule generated for ${response.data.schedule.length} tellers`, "success");
      
    } catch (error) {
      showToast("Failed to generate AI schedule", "error");
      console.error("Error generating AI schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const confirmAiSchedule = () => {
    showToast("AI schedule confirmed and applied!", "success");
    setShowAiModal(false);
    // Optionally redirect to schedule page or refresh
  };

  return (
    <div className={`min-h-screen p-6 ${dark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-lg ${dark ? "bg-blue-900/20" : "bg-blue-100"}`}>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Attendance-Based Scheduler</h1>
              <p className={`text-lg ${dark ? "text-gray-400" : "text-gray-600"}`}>
                Mark today's attendance to generate fair AI-powered schedules
              </p>
            </div>
          </div>

          {/* Date Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                <span className="font-medium">Today's Attendance</span>
              </div>
              <p className="text-lg font-bold mt-1">{currentDate}</p>
            </div>
            <div className={`p-4 rounded-lg border ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-600" />
                <span className="font-medium">AI Schedule For</span>
              </div>
              <p className="text-lg font-bold mt-1">{tomorrow}</p>
            </div>
          </div>
        </div>

        {/* Attendance Status */}
        {attendance && (
          <div className={`mb-6 p-4 rounded-lg border ${dark ? "bg-green-900/20 border-green-700" : "bg-green-50 border-green-200"}`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium">Attendance Marked</span>
            </div>
            <p className="text-sm">
              {attendance.presentTellers.length}/{attendance.totalTellers} tellers present 
              ({attendance.attendanceRate}% attendance rate)
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attendance Marking */}
          <div className="lg:col-span-2">
            <div className={`rounded-lg border p-6 ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Mark Today's Attendance
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {tellers.map(teller => {
                  const isPresent = selectedTellers.includes(teller._id);
                  const isAbsent = absentTellers.some(a => a.userId === teller._id);
                  
                  return (
                    <div
                      key={teller._id}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        isPresent 
                          ? `border-green-500 ${dark ? "bg-green-900/20" : "bg-green-50"}` 
                          : isAbsent
                          ? `border-red-500 ${dark ? "bg-red-900/20" : "bg-red-50"}`
                          : `border-gray-300 ${dark ? "bg-gray-700" : "bg-gray-50"} hover:border-blue-400`
                      }`}
                      onClick={() => handleTellerToggle(teller._id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{teller.name}</p>
                          <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-600"}`}>
                            @{teller.username}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPresent && <Check className="w-5 h-5 text-green-600" />}
                          {isAbsent && <X className="w-5 h-5 text-red-600" />}
                          {!isPresent && !isAbsent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAbsent(teller._id);
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={submitAttendance}
                  disabled={loading || !selectedTellers.length}
                  className={`px-6 py-2 rounded-lg flex items-center gap-2 ${
                    dark ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-500 hover:bg-blue-600"
                  } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Mark Attendance ({selectedTellers.length})
                </button>

                {attendance && (
                  <button
                    onClick={generateAiSchedule}
                    disabled={loading}
                    className={`px-6 py-2 rounded-lg flex items-center gap-2 ${
                      dark ? "bg-purple-600 hover:bg-purple-700" : "bg-purple-500 hover:bg-purple-600"
                    } text-white disabled:opacity-50`}
                  >
                    <Bot className="w-4 h-4" />
                    Generate AI Schedule
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div>
            <div className={`rounded-lg border p-6 ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Quick Stats
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Tellers:</span>
                  <span className="font-bold">{tellers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Present Today:</span>
                  <span className="font-bold text-green-600">{selectedTellers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Absent Today:</span>
                  <span className="font-bold text-red-600">{absentTellers.length}</span>
                </div>
                {attendance && (
                  <div className="flex justify-between">
                    <span>Attendance Rate:</span>
                    <span className="font-bold text-blue-600">{attendance.attendanceRate}%</span>
                  </div>
                )}
              </div>

              {attendance && attendance.presentTellers.length >= 3 && (
                <div className={`mt-4 p-3 rounded-lg ${dark ? "bg-green-900/20" : "bg-green-50"}`}>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Ready for AI scheduling</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Schedule Modal */}
        {showAiModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto ${
              dark ? "bg-gray-800" : "bg-white"
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-purple-600" />
                <h2 className="text-2xl font-bold">AI-Generated Schedule</h2>
              </div>

              <div className="space-y-4 mb-6">
                {aiSchedule.map((assignment, index) => (
                  <div
                    key={assignment.tellerId}
                    className={`p-4 rounded-lg border ${dark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">#{assignment.rank} {assignment.tellerName}</p>
                        <p className="text-sm text-gray-500">{assignment.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-purple-600">Score: {assignment.aiScore}</p>
                        <p className="text-sm text-gray-500">AI Method</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={confirmAiSchedule}
                  className={`flex-1 py-3 rounded-lg ${
                    dark ? "bg-purple-600 hover:bg-purple-700" : "bg-purple-500 hover:bg-purple-600"
                  } text-white font-medium`}
                >
                  Confirm AI Schedule
                </button>
                <button
                  onClick={() => setShowAiModal(false)}
                  className={`px-6 py-3 rounded-lg border ${
                    dark ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}