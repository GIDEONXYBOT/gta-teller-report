import React, { useEffect, useState, useContext, useMemo } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";
import {
  Wallet,
  Loader2,
  CalendarDays,
  Banknote,
  ArrowRight,
  ShieldCheck,
  XCircle,
  ChevronLeft,
  ChevronRight,
  History,
  FileText,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, dark }) => {
  if (!active || !payload || !payload[0]) return null;
  
  const data = payload[0].payload;
  const hasData = data.salary > 0;
  
  if (!hasData) return null;

  return (
    <div className={`${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg p-3 shadow-lg`}>
      <p className="font-semibold mb-2">{data.day} - {data.date}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Base Salary:</span>
          <span className="font-medium">₱{data.baseSalary.toFixed(2)}</span>
        </div>
        {data.over > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-green-600">Over:</span>
            <span className="font-medium text-green-600">+₱{data.over.toFixed(2)}</span>
          </div>
        )}
        {data.short > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-red-600">Short:</span>
            <span className="font-medium text-red-600">-₱{data.short.toFixed(2)}</span>
          </div>
        )}
        {data.deduction > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-orange-600">Deduction:</span>
            <span className="font-medium text-orange-600">-₱{data.deduction.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t pt-1 mt-1 flex justify-between gap-4">
          <span className="font-semibold">Total:</span>
          <span className="font-bold text-indigo-600">₱{data.salary.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default function Payroll() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [payrolls, setPayrolls] = useState([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [dailyReports, setDailyReports] = useState([]);
  const [showReportsModal, setShowReportsModal] = useState(false);

  // 🗓️ Week navigation (Mon–Sun)
  const [weekOffset, setWeekOffset] = useState(0);

  // Debug logging
  console.log("Payroll component - user:", user);
  console.log("Payroll component - loading:", loading);

  const getStartOfWeek = (date) => {
    const newDate = new Date(date);
    const day = newDate.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // Shift to Monday
    newDate.setDate(newDate.getDate() + diff + weekOffset * 7);
    return newDate;
  };

  const startOfWeek = getStartOfWeek(new Date());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999); // Include all of Sunday

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  }, [startOfWeek]);

  // 🔹 Fetch payrolls + withdrawals + daily reports
  useEffect(() => {
    if (!user?._id) return;
    fetchData();
    if (user.role === 'teller') {
      fetchDailyReports();
    }
  }, [user?._id, weekOffset]);

  // Live updates for withdrawals and payroll changes
  useEffect(() => {
    const refresh = () => fetchData();
    const socket = getGlobalSocket();
    if (socket) {
      socket.on("withdrawalApproved", refresh);
      socket.on("withdrawalRejected", refresh);
      socket.on("payrollUpdated", refresh);
      return () => {
        socket.off("withdrawalApproved", refresh);
        socket.off("withdrawalRejected", refresh);
        socket.off("payrollUpdated", refresh);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Use different endpoints based on role
      let payrollEndpoint = `${getApiUrl()}/api/payroll/user/${user._id}`;
      if (user.role === 'supervisor') {
        payrollEndpoint = `${getApiUrl()}/api/supervisor/payroll?supervisorId=${user._id}`;
      }
      
      const [payrollRes, withdrawalRes] = await Promise.all([
        axios.get(payrollEndpoint, { timeout: 30000 }),
        axios.get(`${getApiUrl()}/api/payroll/withdrawals/${user._id}`, { timeout: 30000 }),
      ]);
      
      // Handle different response formats
      let payrolls = [];
      if (user.role === 'supervisor') {
        // Supervisor endpoint now returns an array like tellers
        payrolls = payrollRes.data?.payrolls || [];
      } else {
        payrolls = payrollRes.data?.payrolls || [];
      }
      
      setPayrolls(payrolls);
      setWithdrawalHistory(withdrawalRes.data?.withdrawals || []);
    } catch (err) {
      console.error("❌ Error fetching payroll data:", err);
      showToast({ type: "error", message: "Failed to load payroll data." });
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyReports = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/teller-reports/teller/${user._id}`, { timeout: 30000 });
      const reports = res.data?.reports || [];
      
      // Filter to current week (ensure endOfWeek includes all of Sunday)
      const weekEnd = new Date(endOfWeek);
      weekEnd.setHours(23, 59, 59, 999);
      
      const filtered = reports.filter((report) => {
        const date = new Date(report.createdAt || report.date);
        return date >= startOfWeek && date <= weekEnd;
      });
      
      setDailyReports(filtered);
    } catch (err) {
      console.error("Error fetching daily reports:", err);
      setDailyReports([]);
    }
  };

  // 🧮 Weekly payrolls (Mon–Sun) - normalize dates to compare only dates, not times
  const weeklyPayrolls = useMemo(() => {
    return payrolls.filter((p) => {
      const payrollDate = new Date(p.createdAt || p.date);
      // Normalize all dates to midnight for accurate comparison
      const normalizedPayroll = new Date(payrollDate.getFullYear(), payrollDate.getMonth(), payrollDate.getDate());
      const normalizedStart = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
      const normalizedEnd = new Date(endOfWeek.getFullYear(), endOfWeek.getMonth(), endOfWeek.getDate());
      
      return normalizedPayroll >= normalizedStart && normalizedPayroll <= normalizedEnd;
    });
  }, [payrolls, startOfWeek, endOfWeek]);

  // Only show entries that are not withdrawn (include all payrolls, even with payment terms)
  const visiblePayrolls = useMemo(
    () => weeklyPayrolls.filter((p) => !p.withdrawn),
    [weeklyPayrolls]
  );

  const totalUnwithdrawn = visiblePayrolls.reduce(
    (sum, p) => sum + (Number(p.totalSalary) || 0),
    0
  );

  const remainingBalance = Math.max(
    totalUnwithdrawn - (parseFloat(withdrawAmount) || 0),
    0
  );

  // 📊 Chart data per week (show all payrolls including those with payment terms)
  const chartData = weekDates.map((d) => {
    const record = weeklyPayrolls.find(
      (p) => new Date(p.createdAt || p.date).toDateString() === d.toDateString()
    );
    // Show salary even if negative or zero (payment terms can result in this)
    const salary = record ? Number(record.totalSalary) : 0;
    return {
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      salary: salary,
      baseSalary: record ? record.baseSalary : 0,
      over: record ? record.over : 0,
      short: record ? record.short : 0,
      deduction: record ? record.deduction : 0,
    };
  });

  // 💳 Proceed → show confirmation modal
  const handleProceed = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast({ type: "warning", message: "Enter a valid amount." });
      return;
    }
    if (amount > totalUnwithdrawn) {
      showToast({ type: "warning", message: "Cannot withdraw more than balance." });
      return;
    }
    setConfirmModal(true);
  };

  // ✅ Confirm withdrawal (calls /bulk-withdraw)
  const confirmWithdrawal = async () => {
    try {
      setWithdrawing(true);
      const unwithdrawnIds = weeklyPayrolls
        .filter((p) => !p.withdrawn)
        .map((p) => p._id);

      if (unwithdrawnIds.length === 0) {
        showToast({ type: "warning", message: "No unwithdrawn payrolls found." });
        return;
      }

      const payload = {
        payrollIds: unwithdrawnIds,
        initiatedBy: user._id,
        weekRange: `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`,
      };

      await axios.post(`${getApiUrl()}/api/payroll/bulk-withdraw`, payload);
      showToast({
        type: "success",
        message: `✅ Withdrawal of ₱${withdrawAmount} processed successfully.`,
      });

      setWithdrawAmount("");
      setConfirmModal(false);
      fetchData();
    } catch (err) {
      console.error("❌ Withdraw error:", err);
      showToast({ type: "error", message: "Failed to withdraw." });
    } finally {
      setWithdrawing(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen text-gray-400">
        <div className="text-center">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <p>User not found. Please login again.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center mt-20 text-gray-400">
        <Loader2 className="animate-spin mr-2" /> Loading Payroll Dashboard...
      </div>
    );
  }

  return (
    <div
      className={`p-6 min-h-screen ${
        dark ? "bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-800"
      }`}
    >
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="text-indigo-500" />
          Weekly Payroll Dashboard
        </h1>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            <ChevronLeft />
          </button>
          <p className="text-sm opacity-70">
            {startOfWeek.toLocaleDateString()} – {endOfWeek.toLocaleDateString()}
          </p>
          <button
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      {/* AVAILABLE THIS WEEK (all payrolls for the week) */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Banknote className="text-indigo-500" /> Payroll This Week
        </h2>
        {weeklyPayrolls.length === 0 ? (
          <div className="text-sm opacity-70">No payrolls found for this week.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {weeklyPayrolls.map((p) => (
              <div
                key={p._id}
                onClick={() => { setSelectedPayroll(p); setShowModal(true); }}
                className={`cursor-pointer border rounded-lg p-3 ${
                  p.withdrawn 
                    ? (dark ? 'bg-gray-700 border-gray-600 opacity-60' : 'bg-gray-100 border-gray-300 opacity-60')
                    : (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')
                } hover:shadow`}
              >
                <div className="text-xs opacity-70">
                  {new Date(p.createdAt || p.date).toLocaleDateString()}
                  {p.withdrawn && (
                    <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                      Withdrawn
                    </span>
                  )}
                </div>
                <div className={`font-bold text-lg ${
                  p.withdrawn ? 'text-gray-500' : 'text-indigo-600'
                }`}>
                  ₱{Number(p.totalSalary || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs opacity-70">Tap to view details</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty State */}
      {payrolls.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-6 text-center">
          <Wallet className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
          <h3 className="text-lg font-semibold mb-2">No Payroll Data Yet</h3>
          <p className="text-sm text-gray-400">
            {user.role === 'teller' 
              ? 'Your payroll will appear here once teller reports are submitted and synced.'
              : 'Your payroll will appear here once it has been created by the system.'}
          </p>
        </div>
      )}

      {/* PERFORMANCE SUMMARY - Only for Tellers */}
      {user.role === 'teller' && weeklyPayrolls.length > 0 && (
        <div className={`rounded-lg p-6 mb-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Banknote className="text-indigo-500" /> Weekly Performance Summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="text-sm opacity-70 mb-1">Total Over</div>
              <div className="text-2xl font-bold text-green-500">
                +₱{weeklyPayrolls.reduce((sum, p) => sum + (Number(p.over) || 0), 0).toLocaleString()}
              </div>
              <div className="text-xs opacity-60 mt-1">Bonus earnings</div>
            </div>
            <div className={`p-4 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="text-sm opacity-70 mb-1">Total Short</div>
              <div className="text-2xl font-bold text-red-500">
                -₱{weeklyPayrolls.reduce((sum, p) => sum + (Number(p.short) || 0), 0).toLocaleString()}
              </div>
              <div className="text-xs opacity-60 mt-1">Deductions</div>
            </div>
            <div className={`p-4 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="text-sm opacity-70 mb-1">Net Impact</div>
              <div className={`text-2xl font-bold ${
                (weeklyPayrolls.reduce((sum, p) => sum + (Number(p.over) || 0), 0) - 
                 weeklyPayrolls.reduce((sum, p) => sum + (Number(p.short) || 0), 0)) >= 0 
                  ? 'text-green-500' : 'text-red-500'
              }`}>
                {(weeklyPayrolls.reduce((sum, p) => sum + (Number(p.over) || 0), 0) - 
                  weeklyPayrolls.reduce((sum, p) => sum + (Number(p.short) || 0), 0)) >= 0 ? '+' : ''}
                ₱{Math.abs(
                  weeklyPayrolls.reduce((sum, p) => sum + (Number(p.over) || 0), 0) - 
                  weeklyPayrolls.reduce((sum, p) => sum + (Number(p.short) || 0), 0)
                ).toLocaleString()}
              </div>
              <div className="text-xs opacity-60 mt-1">Over - Short</div>
            </div>
          </div>
        </div>
      )}

      {/* DAILY REPORTS - Only for Tellers */}
      {user.role === 'teller' && dailyReports.length > 0 && (
        <div className={`rounded-lg p-6 mb-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="text-indigo-500" /> Daily Reports This Week
            </h2>
            <button
              onClick={() => setShowReportsModal(true)}
              className="text-sm text-indigo-500 hover:text-indigo-600 font-medium"
            >
              View All Details →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={`${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Day</th>
                  <th className="p-2 text-right">System</th>
                  <th className="p-2 text-right">Cash</th>
                  <th className="p-2 text-right">Over</th>
                  <th className="p-2 text-right">Short</th>
                  <th className="p-2 text-center">Terms</th>
                  <th className="p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.map((report, idx) => {
                  const reportDate = new Date(report.date || report.createdAt);
                  const dayName = reportDate.toLocaleDateString('en-US', { weekday: 'short' });
                  const paymentTerms = Number(report.shortPaymentTerms) || 1;
                  const weeklyDeduction = report.short > 0 && paymentTerms > 1 ? (report.short / paymentTerms) : null;
                  
                  return (
                    <tr key={idx} className={`border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <td className="p-2">{reportDate.toLocaleDateString()}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          dayName === 'Sun' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100' :
                          dayName === 'Sat' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-100'
                        }`}>
                          {dayName}
                        </span>
                      </td>
                      <td className="p-2 text-right">₱{(report.systemBalance || 0).toLocaleString()}</td>
                      <td className="p-2 text-right">₱{(report.cashOnHand || 0).toLocaleString()}</td>
                      <td className="p-2 text-right text-green-600 dark:text-green-400 font-semibold">
                        {report.over > 0 ? `+₱${report.over.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-2 text-right text-red-600 dark:text-red-400 font-semibold">
                        {report.short > 0 ? `-₱${report.short.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-2 text-center">
                        {weeklyDeduction ? (
                          <div className="text-xs">
                            <div className="font-semibold">{paymentTerms}w</div>
                            <div className="text-red-500">₱{weeklyDeduction.toFixed(0)}/w</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          report.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100'
                        }`}>
                          {report.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CHART */}
      <div className="bg-gray-800/10 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Banknote className="text-indigo-500" /> Daily Salary Chart
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip content={<CustomTooltip dark={dark} />} cursor={{ fill: 'rgba(79, 70, 229, 0.1)' }} />
            <Bar dataKey="salary" fill="#4f46e5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* WITHDRAWAL PANEL */}
      <div
        className={`rounded-lg p-6 mb-6 ${
          dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"
        } shadow-md`}
      >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Banknote className="text-indigo-500" /> Withdrawal Section
        </h2>

        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-medium">Available Balance:</p>
          <p className="text-lg font-bold text-green-500">
            ₱{totalUnwithdrawn.toFixed(2)}
          </p>
        </div>

        <div className="flex gap-3 items-center">
          <input
            type="number"
            placeholder="Enter amount"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className={`flex-1 p-2 rounded-md border outline-none ${
              dark
                ? "bg-gray-700 border-gray-600 text-gray-100"
                : "bg-gray-100 border-gray-300"
            }`}
          />
          <button
            onClick={() => setWithdrawAmount(totalUnwithdrawn.toFixed(2))}
            disabled={totalUnwithdrawn <= 0}
            className={`px-3 py-2 text-sm rounded-md ${
              totalUnwithdrawn > 0
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-gray-400 cursor-not-allowed text-gray-200"
            }`}
          >
            Withdraw All
          </button>
          <button
            onClick={handleProceed}
            disabled={totalUnwithdrawn <= 0 || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > totalUnwithdrawn}
            className={`px-5 py-2 rounded-md font-semibold flex items-center gap-1 ${
              totalUnwithdrawn > 0 && withdrawAmount && parseFloat(withdrawAmount) > 0 && parseFloat(withdrawAmount) <= totalUnwithdrawn
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-gray-400 cursor-not-allowed text-gray-200"
            }`}
          >
            Proceed <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {totalUnwithdrawn <= 0 && (
          <div className="mt-3 p-3 rounded-lg text-sm bg-yellow-50 text-yellow-700 border border-yellow-200">
            <span>No funds available for withdrawal.</span>
          </div>
        )}
      </div>

      {/* WITHDRAWAL HISTORY */}
      <div
        className={`rounded-lg p-6 ${
          dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800"
        } shadow-md`}
      >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <History className="text-indigo-500" /> Withdrawal History
        </h2>
        {withdrawalHistory.length === 0 ? (
          <p className="text-sm opacity-60">No withdrawal history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className={`${dark ? "bg-gray-700" : "bg-gray-100"} text-left`}>
                  <th className="p-2 border-b">Date</th>
                  <th className="p-2 border-b">Week Range</th>
                  <th className="p-2 border-b">Amount</th>
                  <th className="p-2 border-b">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalHistory.map((h) => (
                  <tr key={h._id} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                    <td className="p-2 border-b">
                      {new Date(h.createdAt).toLocaleString()}
                    </td>
                    <td className="p-2 border-b">{h.weekRange || "N/A"}</td>
                    <td className="p-2 border-b text-green-500">
                      ₱{h.amount.toFixed(2)}
                    </td>
                    <td className="p-2 border-b text-indigo-500">
                      ₱{h.remaining.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div
            className={`p-6 rounded-xl w-96 shadow-lg ${
              dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
            }`}
          >
            <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
              <ShieldCheck className="text-indigo-500" /> Confirm Withdrawal
            </h2>
            <p className="text-sm mb-4 opacity-80">
              Please confirm your withdrawal details below:
            </p>

            <div className="text-sm space-y-1 mb-3">
              <p>
                <strong>Available Balance:</strong> ₱{totalUnwithdrawn.toFixed(2)}
              </p>
              <p>
                <strong>Withdrawal Amount:</strong> ₱
                {parseFloat(withdrawAmount || 0).toFixed(2)}
              </p>
              <p className="text-green-500">
                <strong>Remaining:</strong> ₱{remainingBalance.toFixed(2)}
              </p>
            </div>

            <div className="flex justify-between mt-5">
              <button
                onClick={() => setConfirmModal(false)}
                className="flex items-center gap-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md"
              >
                <XCircle className="w-4 h-4" /> Cancel
              </button>
              <button
                disabled={withdrawing}
                onClick={confirmWithdrawal}
                className={`flex items-center gap-1 px-5 py-2 rounded-md font-semibold transition ${
                  withdrawing
                    ? "bg-gray-500 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {withdrawing ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" /> Processing...
                  </>
                ) : (
                  <>
                    Confirm <ShieldCheck className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYROLL DETAIL MODAL */}
      {showModal && selectedPayroll && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div
            className={`p-6 rounded-xl w-96 shadow-lg ${
              dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
            }`}
          >
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="text-indigo-500" />{" "}
              {new Date(selectedPayroll.createdAt || selectedPayroll.date).toDateString()}
            </h2>
            <div className="space-y-1 text-sm">
              <p>Base Salary: ₱{Number(selectedPayroll.baseSalary || 0).toFixed(2)}</p>
              <p className="text-green-500">Over: ₱{Number(selectedPayroll.over || 0).toFixed(2)}</p>
              <p className="text-red-500">Short: ₱{Number(selectedPayroll.short || 0).toFixed(2)}</p>
              
              {/* Payment Terms Info */}
              {selectedPayroll.short > 0 && selectedPayroll.shortPaymentTerms > 1 && (
                <div className={`p-2 rounded text-xs ${dark ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700 dark:text-blue-300 font-medium">Payment Plan:</span>
                    <span className="font-semibold">{selectedPayroll.shortPaymentTerms} weeks</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-blue-600 dark:text-blue-400">Weekly Deduction:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      ₱{(selectedPayroll.short / selectedPayroll.shortPaymentTerms).toFixed(2)}/week
                    </span>
                  </div>
                </div>
              )}
              
              {selectedPayroll.deduction > 0 && (
                <p className="text-orange-500">
                  Other Deductions: ₱{Number(selectedPayroll.deduction || 0).toFixed(2)}
                </p>
              )}
              <hr className="my-2" />
              <p className="font-semibold text-indigo-500">
                Net Pay: ₱{Number(selectedPayroll.totalSalary || 0).toFixed(2)}
              </p>
            </div>

            {/* Adjustments & Overrides Section */}
            {selectedPayroll.adjustments?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                <h3 className="font-semibold mb-2 text-sm">Adjustments & Overrides</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedPayroll.adjustments.map((adj, idx) => {
                    const isOverride = adj.reason?.startsWith('[OVERRIDE]');
                    const cleanReason = isOverride ? adj.reason.replace('[OVERRIDE]', '').trim() : '';
                    const displayReason = isOverride ? cleanReason : (adj.reason || "Adjustment");
                    return (
                      <div 
                        key={idx} 
                        className={`p-2 rounded text-xs ${
                          isOverride 
                            ? (dark ? 'bg-purple-900/30 border border-purple-700' : 'bg-purple-50 border border-purple-200')
                            : (dark ? 'bg-gray-700' : 'bg-gray-100')
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            {isOverride && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-600 text-white mr-1">
                                OVERRIDE
                              </span>
                            )}
                            <div className="font-medium">{displayReason}</div>
                            <div className="opacity-60 text-[10px]">{new Date(adj.createdAt).toLocaleString()}</div>
                          </div>
                          <div className={`font-bold ml-2 ${adj.delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {adj.delta >= 0 ? '+' : ''}₱{adj.delta.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full text-gray-400 hover:text-gray-600 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* DAILY REPORTS DETAIL MODAL */}
      {showReportsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div
            className={`p-6 rounded-xl w-full max-w-4xl shadow-lg max-h-[90vh] overflow-y-auto ${
              dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="text-indigo-500" /> Daily Reports Details
              </h2>
              <button
                onClick={() => setShowReportsModal(false)}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {dailyReports.map((report, idx) => {
                const reportDate = new Date(report.date || report.createdAt);
                const dayName = reportDate.toLocaleDateString('en-US', { weekday: 'long' });
                const paymentTerms = Number(report.shortPaymentTerms) || 1;
                const weeklyDeduction = report.short > 0 && paymentTerms > 1 ? (report.short / paymentTerms) : null;
                
                return (
                  <div key={idx} className={`p-4 rounded-lg border ${
                    dark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{dayName}</h3>
                        <p className="text-sm opacity-70">{reportDate.toLocaleDateString()}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        report.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100'
                      }`}>
                        {report.status || 'pending'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="opacity-70">System Balance</div>
                        <div className="font-semibold">₱{(report.systemBalance || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="opacity-70">Cash on Hand</div>
                        <div className="font-semibold">₱{(report.cashOnHand || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="opacity-70">Over</div>
                        <div className="font-semibold text-green-600 dark:text-green-400">
                          {report.over > 0 ? `+₱${report.over.toLocaleString()}` : '₱0'}
                        </div>
                      </div>
                      <div>
                        <div className="opacity-70">Short</div>
                        <div className="font-semibold text-red-600 dark:text-red-400">
                          {report.short > 0 ? `-₱${report.short.toLocaleString()}` : '₱0'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Payment Terms Info */}
                    {weeklyDeduction && (
                      <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Weekly Payment Terms</div>
                        <div className="text-sm mt-1">
                          This short amount will be deducted over <span className="font-semibold">{paymentTerms} weeks</span>
                        </div>
                        <div className="text-sm mt-1">
                          Weekly deduction: <span className="font-semibold text-red-600 dark:text-red-400">₱{weeklyDeduction.toFixed(2)}</span> per week
                        </div>
                      </div>
                    )}
                    
                    {report.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                        <div className="text-sm opacity-70">Notes:</div>
                        <div className="text-sm">{report.notes}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowReportsModal(false)}
                className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
