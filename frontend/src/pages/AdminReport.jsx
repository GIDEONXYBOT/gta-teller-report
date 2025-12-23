import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { API_URL } from "../utils/apiConfig";

const API = API_URL;

export default function AdminReport() {
  const { settings } = useContext(SettingsContext);
  const theme = settings?.theme || {};
  const darkMode = settings?.theme?.mode === "dark";

  const [report, setReport] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(10000); // 10 seconds

  const fetchReport = async () => {
    try {
      const res = await axios.get(`${API}/api/report/admin`);
      setReport(res.data);
      setLoading(false);
      setMessage("✅ Data updated automatically");
      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      console.error("Error loading admin report:", err);
      setMessage("❌ Failed to load admin report");
    }
  };

  // 🕒 Auto Refresh Loop
  useEffect(() => {
    fetchReport(); // initial load

    if (autoRefresh) {
      const timer = setInterval(() => {
        fetchReport();
      }, refreshInterval);

      return () => clearInterval(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshInterval]);

  if (loading)
    return (
      <div
        className="p-6 text-center"
        style={{
          backgroundColor: darkMode ? theme.darkBg : theme.lightBg,
          color: darkMode ? theme.darkFont : theme.lightFont,
        }}
      >
        Loading Admin Report...
      </div>
    );

  return (
    <div
      className="p-6 min-h-screen"
      style={{
        backgroundColor: darkMode ? theme.darkBg : theme.lightBg,
        color: darkMode ? theme.darkFont : theme.lightFont,
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📘 ADMIN REPORT</h1>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchReport}
            className="px-3 py-2 rounded text-sm"
            style={{
              backgroundColor: darkMode ? theme.darkFont : "#2563eb",
              color: darkMode ? theme.darkBg : "#fff",
            }}
          >
            🔄 Refresh Now
          </button>

          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {message && (
        <p className="text-green-500 mb-4 transition-all duration-500">{message}</p>
      )}

      {/* --- MAIN ADMIN REPORT TABLE --- */}
      <div className="rounded-xl shadow p-4" style={{ backgroundColor: darkMode ? "#071026" : "#fff" }}>
        <table className="w-full text-left border-collapse">
          <tbody>
            <ReportRow label="💰 OVERALL CAPITAL" value={report.overallCapital} />
            <ReportRow label="🏦 STARTING CAPITAL" value={report.startingCapital} />
            <ReportRow label="🔁 REVOLVING" value={report.revolving} />
            <ReportRow label="👷 SALARY & OVER" value={report.salaryOver} />
            <ReportRow label="📉 EXPENSES" value={report.expenses} highlight />
            <ReportRow label="💼 COMMISSION" value={report.commission} />
            <ReportRow label="💸 DRAW" value={report.draw} />
            <ReportRow label="🏛 RMI SHARE (50%)" value={report.rmiShare} />
            <ReportRow label="👷 OPERATOR SHARE (50%)" value={report.operatorShare} />
            <ReportRow label="📊 OPERATOR OVER" value={report.operatorOver} />
            <ReportRow label="💹 OP COM & OVER" value={report.opComOver} />
          </tbody>
        </table>
      </div>

      {/* --- HISTORY SECTION --- */}
      <DailyHistory theme={theme} darkMode={darkMode} />
    </div>
  );
}

// Row Component
function ReportRow({ label, value, highlight = false }) {
  return (
    <tr className="border-b">
      <td className="py-3 font-semibold text-lg">{label}</td>
      <td
        className={`py-3 text-right text-xl font-bold ${
          highlight ? "text-red-500 animate-pulse" : "text-indigo-600"
        }`}
      >
        ₱{Number(value || 0).toLocaleString()}
      </td>
    </tr>
  );
}

// --- DAILY HISTORY ---
function DailyHistory({ theme, darkMode }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    try {
      const res = await axios.get(`${API}/api/report/admin/history`);
      setHistory(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading)
    return <p className="mt-6">Loading history...</p>;

  return (
    <div className="mt-10 rounded-xl shadow p-4" style={{ backgroundColor: darkMode ? "#071026" : "#fff" }}>
      <h2 className="text-xl font-bold mb-4">📅 7-Day Summary</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: darkMode ? "#0b1220" : "#f3f4f6" }}>
              <th className="p-2">Date</th>
              <th className="p-2 text-right">Overall</th>
              <th className="p-2 text-right">Start Cap</th>
              <th className="p-2 text-right">Revolving</th>
              <th className="p-2 text-right">Salary+Over</th>
              <th className="p-2 text-right">Expense</th>
              <th className="p-2 text-right">Commission</th>
              <th className="p-2 text-right">Draw</th>
              <th className="p-2 text-right">Op Over</th>
              <th className="p-2 text-right">OpCom+Over</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="p-2 font-semibold">{h.date}</td>
                <td className="p-2 text-right">₱{Number(h.overallCapital).toLocaleString()}</td>
                <td className="p-2 text-right">₱{Number(h.startingCapital).toLocaleString()}</td>
                <td className="p-2 text-right">₱{Number(h.revolving).toLocaleString()}</td>
                <td className="p-2 text-right">₱{Number(h.salaryOver).toLocaleString()}</td>
                <td className="p-2 text-right text-red-500">₱{Number(h.expenses).toLocaleString()}</td>
                <td className="p-2 text-right">₱{Number(h.commission).toLocaleString()}</td>
                <td className="p-2 text-right">₱{Number(h.draw).toLocaleString()}</td>
                <td className="p-2 text-right text-indigo-500">₱{Number(h.operatorOver).toLocaleString()}</td>
                <td className="p-2 text-right text-green-600 font-bold">₱{Number(h.opComOver).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
