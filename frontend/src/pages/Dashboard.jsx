import React, { useEffect, useState, useContext, useMemo } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";
import { StaggerContainer, StaggerItem, FadeInUp, HoverScale } from "../components/UIEffects";
import PlanAbsence from "../components/PlanAbsence";

function Money({ value }) {
  // format currency quick helper
  return typeof value === "number"
    ? `₱${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : "₱0";
}

export default function Dashboard({ overrideRole }) {
  const { settings, user } = useContext(SettingsContext);
  const { showToast } = useToast?.() || {};
  const theme = settings?.theme || {};
  const darkMode = settings?.theme?.mode === "dark";

  // role priority: overrideRole prop -> logged-in user role
  const role = overrideRole || user?.role || "teller";
  const userId = user?._id || user?.id || null;

  // Data states
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalTellers: 0,
    totalSupervisors: 0,
    reportsCount: 0,
    totalCashflow: 0,
    totalPayroll: 0,
  });
  const [cashflowSeries, setCashflowSeries] = useState([]); // [{date, income, expense}]
  const [payrollSeries, setPayrollSeries] = useState([]); // [{month, totalSalary}]
  const [teamStats, setTeamStats] = useState([]); // optional per-teller stats for supervisor/admin

  // memoized CSS colors
  const bg = darkMode ? theme.darkBg || "#071026" : theme.lightBg || "#f8fafc";
  const cardBg = darkMode ? "#0b1220" : "#fff";
  const textColor = darkMode ? theme.darkFont || "#e5e7eb" : theme.lightFont || "#111827";

  // Fetch all dashboard data
  const fetchAll = async () => {
    setLoading(true);
    try {
      const API = getApiUrl(); // Get fresh API URL each time
      // Use only existing backend endpoints; compute missing summaries client-side
      const [usersRes, cashflowRes, payrollAllRes, reportsAllRes] = await Promise.allSettled([
        axios.get(`${API}/api/users`), // list of users
        axios.get(`${API}/api/cashflow/summary/daily`).catch(() => ({ data: [] })), // may not exist yet
        axios.get(`${API}/api/payroll/all`), // all payroll documents
        axios.get(`${API}/api/teller-reports/all`), // all teller reports
      ]);

      // Users summary
      if (usersRes.status === "fulfilled" && Array.isArray(usersRes.value.data)) {
        const users = usersRes.value.data;
        setSummary((s) => ({
          ...s,
          totalTellers: users.filter((u) => u.role === "teller").length,
          totalSupervisors: users.filter((u) => u.role === "supervisor").length,
        }));
      }

      // Cashflow daily series (if endpoint exists)
      if (cashflowRes.status === "fulfilled" && Array.isArray(cashflowRes.value.data)) {
        const daily = cashflowRes.value.data;
        setCashflowSeries(daily);
        const totalCash = daily.reduce((acc, d) => acc + (Number(d.income) || 0) - (Number(d.expense) || 0), 0);
        setSummary((s) => ({ ...s, totalCashflow: totalCash }));
      } else {
        setCashflowSeries([]);
      }

      // Payroll aggregation
      if (payrollAllRes.status === "fulfilled" && payrollAllRes.value.data?.payrolls) {
        const payrolls = payrollAllRes.value.data.payrolls;
        // Total payroll (all roles) or for teller role just that user's total
        let totalPayroll = 0;
        if (role === "teller" && userId) {
          totalPayroll = payrolls
            .filter((p) => p.user?._id === userId || p.user === userId)
            .reduce((sum, p) => sum + (Number(p.totalSalary) || 0), 0);
        } else if (role === "supervisor" && userId) {
          // Supervisor: sum payrolls of their tellers (users referencing supervisorId)
          // Need user list to find team members
          const teamUserIds = (usersRes.status === "fulfilled" ? usersRes.value.data : [])
            .filter((u) => u.supervisorId && (u.supervisorId === userId || u.supervisorId?._id === userId))
            .map((u) => u._id || u.id);
          totalPayroll = payrolls
            .filter((p) => teamUserIds.includes(p.user?._id || p.user))
            .reduce((sum, p) => sum + (Number(p.totalSalary) || 0), 0);
        } else {
          // Admin: all payrolls
            totalPayroll = payrolls.reduce((sum, p) => sum + (Number(p.totalSalary) || 0), 0);
        }

        // Monthly series grouping
        const seriesMap = new Map();
        payrolls.forEach((p) => {
          const created = p.createdAt ? new Date(p.createdAt) : new Date();
          const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
          const prev = seriesMap.get(monthKey) || 0;
          seriesMap.set(monthKey, prev + (Number(p.totalSalary) || 0));
        });
        const series = Array.from(seriesMap.entries())
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([month, totalSalary]) => ({ month, totalSalary }));
        setPayrollSeries(series);
        setSummary((s) => ({ ...s, totalPayroll }));
      } else {
        setPayrollSeries([]);
      }

      // Reports count
      if (reportsAllRes.status === "fulfilled" && Array.isArray(reportsAllRes.value.data?.reports)) {
        const reports = reportsAllRes.value.data.reports;
        setSummary((s) => ({ ...s, reportsCount: reports.length }));
        // For teller role, treat teamStats as own reports for over/short charts reuse
        if (role === "teller" && userId) {
          const myReports = reports.filter((r) => r.tellerId === userId || r.tellerId?._id === userId);
          setTeamStats(myReports); // reuse shape for over/short accumulation
        } else if (role === "supervisor" && userId) {
          const myTeamReports = reports.filter((r) => r.supervisorId === userId || r.supervisorId?._id === userId);
          setTeamStats(myTeamReports);
        } else {
          setTeamStats([]);
        }
      }
    } catch (err) {
      console.error("Dashboard: fetchAll error", err);
      if (showToast) showToast({ type: "error", message: "Failed to load dashboard data" });
    } finally {
      setLoading(false);
    }
  };

  // socket listeners
  useEffect(() => {
    fetchAll();

    const handler = () => {
      // slight debounced refresh visual
      if (showToast) showToast({ type: "info", message: "Dashboard updated" });
      fetchAll();
    };

    const socket = getGlobalSocket();
    if (socket) {
      socket.on("reportUpdated", handler);
      socket.on("cashflowUpdated", handler);
      socket.on("payrollUpdated", handler);
      socket.on("userUpdated", handler);
    }

    return () => {
      if (socket) {
        socket.off("reportUpdated", handler);
        socket.off("cashflowUpdated", handler);
        socket.off("payrollUpdated", handler);
        socket.off("userUpdated", handler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // computed summaries for cards, role-specific
  const cards = useMemo(() => {
    if (role === "admin") {
      return [
        { title: "Tellers", value: summary.totalTellers, subtitle: "Active Tellers" },
        { title: "Supervisors", value: summary.totalSupervisors, subtitle: "Active Supervisors" },
        { title: "Reports", value: summary.reportsCount, subtitle: "Today / This Month" },
        { title: "Cashflow", value: Money({ value: summary.totalCashflow }), subtitle: "Net cashflow" },
        { title: "Payroll", value: Money({ value: summary.totalPayroll }), subtitle: "Total payroll cost" },
      ];
    } else if (role === "supervisor") {
      return [
        { title: "My Tellers", value: teamStats.length, subtitle: "Team size" },
        { title: "Verified Reports", value: summary.reportsCount, subtitle: "Verified / Pending" },
        { title: "Team Over", value: Money({ value: teamStats.reduce((a, t) => a + (t.over || 0), 0) }), subtitle: "Sum of over" },
        { title: "Team Short", value: Money({ value: teamStats.reduce((a, t) => a + (t.short || 0), 0) }), subtitle: "Sum of short" },
        { title: "Team Payroll", value: Money({ value: summary.totalPayroll }), subtitle: "Estimated payroll" },
      ];
    } else {
      // teller
      return [
        { title: "My Reports", value: summary.reportsCount, subtitle: "Submitted" },
        { title: "My Over", value: Money({ value: teamStats.reduce((a, t) => a + (t.over || 0), 0) }), subtitle: "Total over" },
        { title: "My Short", value: Money({ value: teamStats.reduce((a, t) => a + (t.short || 0), 0) }), subtitle: "Total short" },
        { title: "My Salary", value: Money({ value: summary.totalPayroll }), subtitle: "Recent payroll" },
        { title: "Points", value: "—", subtitle: "Teller of the Month points" },
      ];
    }
  }, [role, summary, teamStats]);

  // Simple card component
  function StatCard({ item, index }) {
    return (
      <StaggerItem>
        <HoverScale>
          <div
            className="p-4 rounded-lg shadow-sm card-hover cursor-pointer transition-all duration-300 hover:shadow-lg"
            style={{ background: cardBg, color: textColor }}
          >
            <div className="text-sm text-gray-400 mb-2">{item.subtitle}</div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-lg font-bold mb-1">{item.title}</div>
                <div className="text-2xl font-extrabold">{item.value}</div>
              </div>
              <div className="text-3xl opacity-20">
                {index === 0 && "👥"}
                {index === 1 && "👔"}
                {index === 2 && "📊"}
                {index === 3 && "💰"}
                {index === 4 && "💼"}
              </div>
            </div>
          </div>
        </HoverScale>
      </StaggerItem>
    );
  }

  // small loaders
  if (loading) {
    return (
      <div style={{ background: bg, minHeight: "70vh", color: textColor }} className="p-6">
        <div className="animate-pulse space-y-4 max-w-6xl mx-auto">
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render
  return (
    <div style={{ background: bg, color: textColor, minHeight: "80vh" }} className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <FadeInUp className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Welcome back{user?.name ? `, ${user.name}` : ""}</h1>
            <p className="text-sm text-gray-400">Overview & live metrics</p>
          </div>
          <div className="text-sm text-gray-400">
            <div>Role: <span className="font-semibold">{role}</span></div>
          </div>
        </FadeInUp>

        {/* Summary cards */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {cards.map((c, idx) => (
            <StatCard key={idx} item={c} index={idx} />
          ))}
        </StaggerContainer>

        {/* Charts area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cashflow line chart */}
          <FadeInUp delay={0.2}>
            <div className="p-4 rounded-lg shadow card-hover" style={{ background: cardBg, minWidth: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Cashflow (Daily)</h2>
                <div className="text-sm text-gray-400">Income vs Expense</div>
              </div>
              <div style={{ width: "100%", height: 320 }}>
                {cashflowSeries && cashflowSeries.length > 0 ? (
                  <ResponsiveContainer>
                    <LineChart data={cashflowSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: textColor }} />
                      <YAxis tick={{ fill: textColor }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} />
                      <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-gray-400 py-20">No cashflow data</div>
                )}
              </div>
            </div>
          </FadeInUp>

          {/* Payroll bar chart */}
          <FadeInUp delay={0.4}>
            <div className="p-4 rounded-lg shadow card-hover" style={{ background: cardBg, minWidth: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Payroll Trend (Monthly)</h2>
                <div className="text-sm text-gray-400">Total payroll per month</div>
              </div>
              <div style={{ width: "100%", height: 320 }}>
                {payrollSeries && payrollSeries.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={payrollSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fill: textColor }} />
                      <YAxis tick={{ fill: textColor }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalSalary" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-gray-400 py-20">No payroll data</div>
                )}
              </div>
            </div>
          </FadeInUp>
        </div>

        {/* Role-specific section */}
        <div className="mt-6">
          {role === "admin" && (
            <div className="p-4 rounded-lg shadow" style={{ background: cardBg }}>
              <h3 className="font-semibold mb-2">Quick Actions</h3>
              <div className="flex gap-2 flex-wrap">
                <button className="px-3 py-2 rounded bg-indigo-600 text-white">View Reports</button>
                <button className="px-3 py-2 rounded bg-emerald-600 text-white">Open Cashflow</button>
                <button className="px-3 py-2 rounded bg-yellow-500 text-white">Payroll Management</button>
              </div>
            </div>
          )}

          {role === "supervisor" && (
            <div className="p-4 rounded-lg shadow" style={{ background: cardBg }}>
              <h3 className="font-semibold mb-2">Team Overview</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-400">Active Tellers</div>
                  <div className="font-bold text-xl">{teamStats.length}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Team Over</div>
                  <div className="font-bold text-xl">
                    {Money({ value: teamStats.reduce((a, t) => a + (t.over || 0), 0) })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Team Short</div>
                  <div className="font-bold text-xl">
                    {Money({ value: teamStats.reduce((a, t) => a + (t.short || 0), 0) })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {role === "teller" && (
            <div>
              <PlanAbsence />
              <div className="p-4 rounded-lg shadow mt-6" style={{ background: cardBg }}>
                <h3 className="font-semibold mb-2">Personal Summary</h3>
                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-400">Reports</div>
                    <div className="font-bold">{summary.reportsCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Over</div>
                    <div className="font-bold">{Money({ value: teamStats.reduce((a, t) => a + (t.over || 0), 0) })}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Short</div>
                    <div className="font-bold">{Money({ value: teamStats.reduce((a, t) => a + (t.short || 0), 0) })}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Salary</div>
                    <div className="font-bold">{Money({ value: summary.totalPayroll })}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
