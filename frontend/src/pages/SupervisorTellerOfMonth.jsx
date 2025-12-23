import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function SupervisorEmployeeOfMonth() {
  const { settings } = useContext(SettingsContext);
  const theme = settings?.theme || {};
  const darkMode = settings?.theme?.mode === "dark";

  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API}/api/supervisor/employee-month`);
        setRanking(res.data || []);
      } catch (err) {
        console.error("Failed to load teller ranking:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
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
      <h1 className="text-2xl font-bold mb-4">Teller Ranking (Supervisor view)</h1>

      <div className="rounded-lg shadow p-4" style={{ backgroundColor: darkMode ? "#071026" : "#fff" }}>
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: darkMode ? "#0b1220" : "#f3f4f6" }}>
            <tr>
              <th className="p-2">Rank</th>
              <th className="p-2">Teller</th>
              <th className="p-2">Total Bets</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr key={r._id || i} className="border-b">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2">₱{Number(r.totalBet || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
