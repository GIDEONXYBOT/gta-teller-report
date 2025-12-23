import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext.jsx";

export default function AdminTellerReport() {
  const { settings } = useContext(SettingsContext);

  const theme = settings?.theme || {
    mode: "light",
    lightBg: "#f3f4f6",
    darkBg: "#0f172a",
    lightFont: "#111827",
    darkFont: "#e5e7eb",
  };

  const [tellerReports, setTellerReports] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(true);

  const denomOrder = [1000, 500, 200, 100, 50, "coins"];

  useEffect(() => {
    fetchReports();
  }, [selectedDate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:5000/api/reports/tellers?date=${selectedDate}`
      );
      setTellerReports(res.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch teller reports:", err);
      setTellerReports([]);
    } finally {
      setLoading(false);
    }
  };

  const totalCash = (report) => {
    const d = report.denominations || {};
    return (
      (d["1000"] || 0) * 1000 +
      (d["500"] || 0) * 500 +
      (d["200"] || 0) * 200 +
      (d["100"] || 0) * 100 +
      (d["50"] || 0) * 50 +
      (d["coins"] || 0)
    );
  };

  const isDark = theme.mode === "dark";

  return (
    <div
      className="min-h-screen flex flex-col items-center py-10 px-6 transition-all"
      style={{
        backgroundColor: isDark ? theme.darkBg : theme.lightBg,
        color: isDark ? theme.darkFont : theme.lightFont,
      }}
    >
      <div
        className="w-full max-w-6xl rounded-2xl p-6 shadow-xl transition-all"
        style={{
          backgroundColor: isDark
            ? "rgba(255,255,255,0.05)"
            : "rgba(0,0,0,0.05)",
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">🧾 Teller Reports</h1>

          <div className="flex items-center gap-2">
            <label className="font-semibold">Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-2 rounded border"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-lg">Loading reports...</div>
        ) : tellerReports.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No reports found for this date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border rounded-lg overflow-hidden">
              <thead
                className="text-sm uppercase tracking-wide"
                style={{
                  backgroundColor: isDark ? "#1e293b" : "#e5e7eb",
                  color: isDark ? "#f8fafc" : "#111827",
                }}
              >
                <tr>
                  <th className="p-3 text-left">Teller</th>
                  {denomOrder.map((denom) => (
                    <th key={denom} className="p-3 text-right">
                      {denom === "coins" ? "Coins" : `₱${denom}`}
                    </th>
                  ))}
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-left">Remarks</th>
                </tr>
              </thead>

              <tbody>
                {tellerReports.map((report, idx) => {
                  const d = report.denominations || {};
                  return (
                    <tr
                      key={idx}
                      className="border-b hover:bg-gray-100/10 transition-all"
                    >
                      <td className="p-3 font-medium">{report.tellerName}</td>

                      {denomOrder.map((denom) => (
                        <td key={denom} className="p-3 text-right">
                          {d[denom] || 0}
                        </td>
                      ))}

                      <td className="p-3 text-right font-bold">
                        ₱{totalCash(report).toLocaleString()}
                      </td>

                      <td className="p-3">{report.remarks || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
