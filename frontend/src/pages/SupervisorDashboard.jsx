import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { getApiUrl } from "../utils/apiConfig";
import { SettingsContext } from "../context/SettingsContext";
import { getGlobalSocket } from "../utils/globalSocket";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function SupervisorDashboard() {
  const { settings, user } = useContext(SettingsContext);
  const navigate = useNavigate();
  const theme = settings?.theme || {};
  const darkMode = settings?.theme?.mode === "dark";

  const [summary, setSummary] = useState({
    totalTellers: 0,
    verifiedReports: 0,
    pendingReports: 0,
    totalCapital: 0,
    todayCapitalAdded: 0,
    todayAdditional: 0,
    todayRemittance: 0,
  });
  const [payroll, setPayroll] = useState(null);
  const [tellers, setTellers] = useState([]);
  const [payrollHistory, setPayrollHistory] = useState([]);

  const fetch = async () => {
    try {
      const API = getApiUrl(); // Get fresh API URL
      const supId = user?._id;
      const res = await axios.get(`${API}/api/supervisor/dashboard`, { params: { supervisorId: supId } });
      setSummary(res.data.summary || summary);
      setPayroll(res.data.payroll || null);
      setTellers(res.data.tellers || []);
    } catch (err) {
      console.error("Failed to fetch supervisor dashboard:", err);
    }
  };

  const fetchPayrollHistory = async () => {
    try {
      const API = getApiUrl(); // Get fresh API URL
      const supId = user?._id;
      const res = await axios.get(`${API}/api/payroll/user/${supId}`);
      const payrolls = res.data?.payrolls || [];
      // Group by month for chart (last 6 months)
      const monthMap = new Map();
      payrolls.forEach(p => {
        const d = new Date(p.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        monthMap.set(key, (monthMap.get(key) || 0) + (p.totalSalary || 0));
      });
      const series = Array.from(monthMap.entries())
        .sort((a,b) => a[0] < b[0] ? -1 : 1)
        .slice(-6)
        .map(([month, total]) => ({ month, totalSalary: total }));
      setPayrollHistory(series);
    } catch (err) {
      console.error('Failed to fetch payroll history:', err);
    }
  };

  useEffect(() => {
    fetch();
    fetchPayrollHistory();

    const socket = getGlobalSocket();
    if (socket) {
      socket.on("supervisorReportUpdated", () => {
        fetch();
      });

      socket.on("payrollUpdated", () => {
        fetch();
        fetchPayrollHistory();
      });

      socket.on("tellerManagementUpdated", () => {
        fetch();
      });
    }

    return () => {
      if (socket) {
        socket.off("supervisorReportUpdated");
        socket.off("payrollUpdated");
        socket.off("tellerManagementUpdated");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="p-6 min-h-screen"
      style={{
        backgroundColor: darkMode ? theme.darkBg : theme.lightBg,
        color: darkMode ? theme.darkFont : theme.lightFont,
      }}
    >
      <h1 className="text-2xl font-bold mb-4">Supervisor Dashboard</h1>

      {/* Transaction Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4 mb-6">
        <Card title="Total Tellers" value={summary.totalTellers} darkMode={darkMode} theme={theme} />
        <Card title="Verified Reports" value={summary.verifiedReports} darkMode={darkMode} theme={theme} />
        <Card title="Pending Reports" value={summary.pendingReports} darkMode={darkMode} theme={theme} />
        <Card title="Total Capital" value={`₱${Number(summary.totalCapital || 0).toLocaleString()}`} darkMode={darkMode} theme={theme} />
      </div>

      {/* Today's Transaction Totals */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-6">
        <Card 
          title="Capital Added Today" 
          value={`₱${Number(summary.todayCapitalAdded || 0).toLocaleString()}`} 
          darkMode={darkMode} 
          theme={theme}
          subtitle="Starting capital given"
        />
        <Card 
          title="Additional Today" 
          value={`₱${Number(summary.todayAdditional || 0).toLocaleString()}`} 
          darkMode={darkMode} 
          theme={theme}
          subtitle="Extra funds added"
        />
        <Card 
          title="Remittance Today" 
          value={`₱${Number(summary.todayRemittance || 0).toLocaleString()}`} 
          darkMode={darkMode} 
          theme={theme}
          subtitle="Collected from tellers"
        />
      </div>

      {/* Payroll Overview + Graph */}
      {payroll && (
        <div className="mb-6 rounded-lg shadow p-4" style={{ backgroundColor: darkMode ? "#071026" : "#fff" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">My Payroll ({payroll.month})</h2>
            <button
              disabled
              className="px-4 py-2 rounded bg-gray-400 cursor-not-allowed text-white text-sm"
            >
              Payroll View Disabled
            </button>
          </div>
          <div className="flex gap-6 items-center">
            <div>
              <div className="text-sm text-gray-400">Base Salary</div>
              <div className="text-xl font-bold">₱{Number(payroll.baseSalary || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Total Salary</div>
              <div className="text-2xl font-bold text-green-500">₱{Number(payroll.totalSalary || 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Payroll Trend Chart */}
          {payrollHistory.length > 0 && (
            <div className="mt-6" style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={payrollHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: darkMode ? '#e5e7eb' : '#111827' }} />
                  <YAxis tick={{ fill: darkMode ? '#e5e7eb' : '#111827' }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="totalSalary" stroke="#10b981" strokeWidth={2} name="Total Salary" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg shadow p-4" style={{ backgroundColor: darkMode ? "#071026" : "#fff" }}>
        <h2 className="font-semibold mb-3">Tomorrow's Assignments <span className="text-xs text-gray-400 ml-2">(view-only)</span></h2>
        {tellers.length === 0 ? (
          <p>No tellers assigned for tomorrow yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead style={{ backgroundColor: darkMode ? "#0b1220" : "#f3f4f6" }}>
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Status</th>
                <th className="p-2">Verified Reports</th>
                <th className="p-2">Pending</th>
              </tr>
            </thead>
            <tbody>
              {tellers.map((t) => (
                <tr key={t._id} className="border-b">
                  <td className="p-2">{t.name}</td>
                  <td className="p-2">{t.active ? "Online" : "Offline"}</td>
                  <td className="p-2">{t.verifiedReports || 0}</td>
                  <td className="p-2">{t.pendingReports || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Card({ title, value, darkMode, theme, subtitle }) {
  return (
    <div className="p-4 rounded-xl shadow" style={{
      backgroundColor: darkMode ? "#0b1220" : "#fff",
      color: darkMode ? theme.darkFont : theme.lightFont
    }}>
      <div className="text-sm text-gray-400">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
