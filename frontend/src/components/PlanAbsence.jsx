import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { Calendar, X, Plus, Trash2, AlertCircle } from "lucide-react";
import { getApiUrl } from "../utils/apiConfig";

const API = getApiUrl();

export default function PlanAbsence() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [showModal, setShowModal] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("Personal");
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);
  const [plannedAbsences, setPlannedAbsences] = useState([]);
  const [loading, setLoading] = useState(false);

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Fetch user's planned absences
  const fetchAbsences = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/schedule/planned-absences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlannedAbsences(res.data.absences || []);
    } catch (err) {
      console.error("Failed to fetch absences:", err);
    }
  };

  useEffect(() => {
    if (user?.role === "teller" || user?.role === "supervisor_teller") {
      fetchAbsences();
    }
  }, [user]);

  const handlePlanAbsence = async () => {
    if (!startDate || !endDate) {
      showToast({ type: "error", message: "Please select start and end dates" });
      return;
    }

    if (isRecurring && selectedDays.length === 0) {
      showToast({ type: "error", message: "Please select at least one day for recurring absence" });
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/api/schedule/plan-absence`,
        {
          startDate,
          endDate,
          reason,
          daysOfWeek: selectedDays,
          isRecurring,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast({ type: "success", message: "Absence planned successfully!" });
      fetchAbsences();

      // Reset form
      setStartDate("");
      setEndDate("");
      setReason("Personal");
      setIsRecurring(false);
      setSelectedDays([]);
      setShowModal(false);
    } catch (err) {
      console.error("Failed to plan absence:", err);
      showToast({ type: "error", message: "Failed to plan absence" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAbsence = async (absenceId) => {
    if (!window.confirm("Cancel this absence plan?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/schedule/cancel-absence/${absenceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      showToast({ type: "success", message: "Absence cancelled" });
      fetchAbsences();
    } catch (err) {
      console.error("Failed to cancel absence:", err);
      showToast({ type: "error", message: "Failed to cancel absence" });
    }
  };

  const toggleDay = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // Only show for tellers
  if (user?.role !== "teller" && user?.role !== "supervisor_teller") {
    return null;
  }

  return (
    <div className={`rounded-lg shadow p-4 mb-8 ${dark ? "bg-gray-800" : "bg-white"}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-orange-500" /> Plan Absence
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" /> Plan Absence
        </button>
      </div>

      {plannedAbsences.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No absences planned. You will be available for all scheduled shifts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plannedAbsences.map((absence) => (
            <div
              key={absence._id}
              className={`p-4 rounded-lg border ${
                dark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-orange-600">
                    {new Date(absence.startDate).toLocaleDateString()} → {new Date(absence.endDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Reason: <span className="font-medium">{absence.reason}</span>
                  </p>
                  {absence.isRecurring && (
                    <p className="text-xs text-gray-400 mt-1">
                      Recurring: {absence.daysOfWeek?.join(", ")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleCancelAbsence(absence._id)}
                  className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"
                  title="Cancel this absence plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Absence Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div
            className={`rounded-2xl shadow-lg p-6 w-full max-w-md ${
              dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                Plan Your Absence
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full p-2 border rounded-lg ${
                    dark
                      ? "bg-gray-700 border-gray-600 text-gray-100"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full p-2 border rounded-lg ${
                    dark
                      ? "bg-gray-700 border-gray-600 text-gray-100"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium mb-2">Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={`w-full p-2 border rounded-lg ${
                    dark
                      ? "bg-gray-700 border-gray-600 text-gray-100"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                >
                  <option value="Personal">Personal</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Vacation">Vacation</option>
                  <option value="Family">Family Matter</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Recurring Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="recurring" className="text-sm font-medium">
                  Recurring (same days every week)
                </label>
              </div>

              {/* Day Selection for Recurring */}
              {isRecurring && (
                <div>
                  <label className="block text-sm font-medium mb-2">Select Days</label>
                  <div className="grid grid-cols-4 gap-2">
                    {daysOfWeek.map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`py-2 px-3 text-xs rounded-lg font-medium transition ${
                          selectedDays.includes(day)
                            ? "bg-orange-600 text-white"
                            : dark
                            ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-500 text-white hover:opacity-90"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlanAbsence}
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {loading ? "Planning..." : "Plan Absence"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
