import React, { useEffect, useState } from "react";
import axios from "axios";
import SidebarLayout from "../components/SidebarLayout";

export default function AdminAssistantAdmin() {
  const [supervisors, setSupervisors] = useState([]);
  const [assistant, setAssistant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [message, setMessage] = useState("");

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // Fetch supervisors & current assistant admin
  const fetchData = async () => {
    try {
      const [usersRes, assistantRes] = await Promise.all([
        axios.get(`${API_URL}/users`), // Assuming /users lists all users
        axios.get(`${API_URL}/admin/assistant`),
      ]);

      const supervisorList = usersRes.data.filter((u) => u.role === "supervisor");
      setSupervisors(supervisorList);
      setAssistant(assistantRes.data);
    } catch (err) {
      console.error("Error loading data:", err);
      setMessage("⚠️ Failed to load supervisors or assistant admin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const assignAssistant = async () => {
    if (!selectedSupervisor) return alert("Please select a supervisor first.");
    try {
      await axios.put(`${API_URL}/admin/assign-assistant/${selectedSupervisor}`, {
        assign: true,
      });
      setMessage("✅ Assistant Admin assigned successfully!");
      fetchData();
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to assign Assistant Admin.");
    }
  };

  const removeAssistant = async () => {
    if (!assistant?._id) return alert("No assistant assigned currently.");
    try {
      await axios.put(`${API_URL}/admin/assign-assistant/${assistant._id}`, {
        assign: false,
      });
      setMessage("🗑️ Assistant Admin removed.");
      fetchData();
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to remove Assistant Admin.");
    }
  };

  return (
    <SidebarLayout role="admin">
      <div className="p-6 fade-in">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">
          🧑‍💼 Assistant Admin Control
        </h1>

        {loading ? (
          <p className="text-gray-500">Loading data...</p>
        ) : (
          <div className="space-y-6">
            {/* Current Assistant Admin */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow">
              <h2 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">
                Current Assistant Admin
              </h2>
              {assistant && assistant._id ? (
                <div className="flex items-center justify-between">
                  <p className="text-gray-800 dark:text-gray-100">
                    <strong>{assistant.fullName}</strong> ({assistant.username})
                  </p>
                  <button
                    onClick={removeAssistant}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p className="text-gray-500">No Assistant Admin assigned.</p>
              )}
            </div>

            {/* Assign new assistant admin */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow">
              <h2 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">
                Assign New Assistant Admin
              </h2>
              <div className="flex flex-col md:flex-row items-center gap-3">
                <select
                  className="p-2 border rounded-lg flex-1 dark:bg-gray-700 dark:text-gray-100"
                  value={selectedSupervisor}
                  onChange={(e) => setSelectedSupervisor(e.target.value)}
                >
                  <option value="">Select Supervisor</option>
                  {supervisors.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.fullName || s.username}
                    </option>
                  ))}
                </select>
                <button
                  onClick={assignAssistant}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow"
                >
                  Assign
                </button>
              </div>
            </div>

            {/* Feedback */}
            {message && (
              <div className="p-3 mt-3 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 shadow">
                {message}
              </div>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
