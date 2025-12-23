import React, { useState, useEffect, useRef, useContext } from "react";
import axios from "axios";
import { useReactToPrint } from "react-to-print";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext"; // ✅ optional toast hook
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";

export default function TellerOfMonth({ userRole = "teller" }) {
  const { settings } = useContext(SettingsContext);
  const theme = settings?.theme || {};
  const darkMode = settings?.theme?.mode === "dark";
  const { showToast } = useToast?.() || {}; // optional safe toast
  const printRef = useRef();

  const [tellers, setTellers] = useState([]);
  const [prizes, setPrizes] = useState({
    first: "₱1000 Worth of Gift Check",
    second: "₱700 Worth of Gift Check",
    third: "₱500 Worth of Gift Check",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  // 🧠 Fetch leaderboard
  const fetchTellerBets = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/employee/monthly`);
      const data =
        Array.isArray(res.data)
          ? res.data
          : res.data?.tellers || res.data?.employees || res.data?.data || [];
      setTellers(data);
    } catch (err) {
      console.error("❌ Error fetching teller of the month data:", err);
      setTellers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTellerBets();

    // 🔔 Listen to real-time updates
    const socket = getGlobalSocket();
    if (socket) {
      socket.on("reportUpdated", () => {
        setRefreshing(true);
        fetchTellerBets();
        if (showToast) showToast({ type: "info", message: "Leaderboard updated" });
      });

      return () => {
        socket.off("reportUpdated");
      };
    }
  }, []);

  // 🏆 Prize management (admin only)
  const handlePrizeChange = (field, value) => {
    setPrizes({ ...prizes, [field]: value });
  };

  const handleSavePrizes = async () => {
    try {
      await axios.post(`${getApiUrl()}/api/employee/prizes`, prizes);
      if (showToast)
        showToast({ type: "success", message: "Prizes updated successfully!" });
      else alert("🏆 Prizes updated successfully!");
    } catch (err) {
      console.error("❌ Error saving prizes:", err);
      if (showToast)
        showToast({ type: "error", message: "Failed to save prizes" });
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset Teller of the Month data for new month?")) return;
    try {
      await axios.delete(`${getApiUrl()}/api/employee/reset`);
      setTellers([]);
      if (showToast)
        showToast({ type: "warning", message: "Teller data reset for new month" });
      else alert("✅ Teller data reset for new month!");
    } catch (err) {
      console.error("❌ Error resetting data:", err);
      if (showToast)
        showToast({ type: "error", message: "Failed to reset data" });
    }
  };

  if (loading)
    return (
      <div
        className="flex justify-center items-center min-h-screen"
        style={{
          backgroundColor: darkMode ? theme.darkBg : theme.lightBg,
          color: darkMode ? theme.darkFont : theme.lightFont,
        }}
      >
        <p className="animate-pulse">Loading Teller of the Month data...</p>
      </div>
    );

  return (
    <div
      className="min-h-screen p-6 transition-all"
      style={{
        backgroundColor: darkMode ? theme.darkBg : theme.lightBg,
        color: darkMode ? theme.darkFont : theme.lightFont,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-indigo-600">
          🏆 Teller of the Month
        </h1>
        {refreshing && (
          <span className="text-sm text-gray-400 animate-pulse">
            Refreshing leaderboard...
          </span>
        )}
      </div>

      {/* Prize Setup for Admin */}
      {(userRole === "admin" || userRole === "super_admin") && (
        <div
          className="rounded-xl shadow-md p-5 mb-6"
          style={{ backgroundColor: darkMode ? "#071026" : "#fff" }}
        >
          <h2 className="text-xl font-semibold mb-4 text-indigo-500">
            Prize Setup
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {["first", "second", "third"].map((rank) => (
              <div key={rank}>
                <label className="block font-medium capitalize mb-1">
                  {rank} Place Prize
                </label>
                <input
                  type="text"
                  value={prizes[rank]}
                  onChange={(e) => handlePrizeChange(rank, e.target.value)}
                  className="w-full p-2 border rounded"
                  style={{
                    backgroundColor: darkMode ? theme.darkBg : "#f9fafb",
                    color: darkMode ? theme.darkFont : "#111",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={handleSavePrizes}
              className="px-4 py-2 rounded-lg"
              style={{
                backgroundColor: darkMode ? "#111827" : "#4f46e5",
                color: "#fff",
              }}
            >
              💾 Save Prizes
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg"
              style={{
                backgroundColor: darkMode ? "#7f1d1d" : "#dc2626",
                color: "#fff",
              }}
            >
              ♻️ Reset Data
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg"
              style={{
                backgroundColor: darkMode ? "#064e3b" : "#059669",
                color: "#fff",
              }}
            >
              🖨 Print
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard visible to all roles */}
      <div
        ref={printRef}
        className="rounded-xl shadow-md p-5"
        style={{ backgroundColor: darkMode ? "#071026" : "#fff" }}
      >
        <h2 className="text-xl font-semibold mb-3 text-indigo-500">
          Leaderboard (Auto-ranked by Total Bet)
        </h2>

        {Array.isArray(tellers) && tellers.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm uppercase tracking-wide">
                <th className="p-2 border-b">Rank</th>
                <th className="p-2 border-b">Name</th>
                <th className="p-2 border-b">Role</th>
                <th className="p-2 border-b">Total Bet (₱)</th>
                <th className="p-2 border-b">Prize</th>
              </tr>
            </thead>
            <tbody>
              {tellers.map((teller, index) => (
                <tr
                  key={teller._id || index}
                  className={`text-sm ${
                    index === 0 ? "font-semibold text-yellow-500" : ""
                  }`}
                >
                  <td className="p-2 border-b">{index + 1}</td>
                  <td className="p-2 border-b">{teller.name}</td>
                  <td className="p-2 border-b capitalize">{teller.role}</td>
                  <td className="p-2 border-b">
                    ₱{Number(teller.totalBet || 0).toLocaleString()}
                  </td>
                  <td className="p-2 border-b">
                    {index === 0
                      ? prizes.first
                      : index === 1
                      ? prizes.second
                      : index === 2
                      ? prizes.third
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-gray-500 py-4">
            No teller data available for this month yet.
          </p>
        )}
      </div>
    </div>
  );
}
