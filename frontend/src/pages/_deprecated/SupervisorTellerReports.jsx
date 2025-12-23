// DEPRECATED: archived from src/pages/SupervisorTellerReports.jsx on 2025-11-14
import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";

export default function SupervisorTellerReports() {
  const { settings } = useContext(SettingsContext);
  const theme = settings?.theme || {};
  const darkMode = settings?.theme?.mode === "dark";

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/supervisor/tellers`);
      setReports(res.data || []);
    } catch (err) {
      console.error("Failed to load teller reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();

    const socket = getGlobalSocket();
    if (socket) {
      socket.on("tellerReportCreated", fetch);
      socket.on("tellerReportVerified", fetch);

      return () => {
        socket.off("tellerReportCreated");
        socket.off("tellerReportVerified");
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div
      className="p-6 min-h-screen"
      style={{
        backgroundColor: darkMode ? theme.darkBg : theme.lightBg,
        color: darkMode ? theme.darkFont : theme.lightFont,
      }}
    >
      <h1 className="text-2xl font-bold mb-4">Teller Reports</h1>

      <div className="rounded-lg shadow p-4" style={{ backgroundColor: darkMode ? "#071026" : "#fff" }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: darkMode ? "#0b1220" : "#f3f4f6" }}>
            <tr>
              <th className="p-2">Teller</th>
              <th className="p-2">Date</th>
              <th className="p-2">Cash In</th>
              <th className="p-2">Short/Over</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r._id} className="border-b">
                <td className="p-2">{r.tellerName}</td>
                <td className="p-2">{new Date(r.date).toLocaleString()}</td>
                <td className="p-2">₱{Number(r.cashOnHand || 0).toLocaleString()}</td>
                <td className="p-2">{r.shortOver}</td>
                <td className="p-2">{r.verified ? "Verified" : "Pending"}</td>
                <td className="p-2">
                  {/* Supervisor verifies */}
                  {!r.verified && (
                    <button
                      onClick={() => verifyReport(r._id)}
                      className="px-3 py-1 rounded text-white"
                      style={{ backgroundColor: darkMode ? theme.darkFont : "#2563eb" }}
                    >
                      Verify
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  async function verifyReport(id) {
    try {
      await axios.put(`${getApiUrl()}/api/tellers/report/verify/${id}`);
      // emit or let backend emit; refresh
      setReports((prev) => prev.map((p) => (p._id === id ? { ...p, verified: true } : p)));
    } catch (err) {
      console.error("Failed to verify report:", err);
      alert("Failed to verify report");
    }
  }
}
