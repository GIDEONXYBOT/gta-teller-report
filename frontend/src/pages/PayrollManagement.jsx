import React, { useEffect, useMemo, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";
import {
  ClipboardList,
  CheckCircle,
  Clock,
  DollarSign,
  Search,
  Filter,
  User,
  Edit3,
  Eye,
  Lock,
  Unlock,
  X,
  Check,
  Calendar,
  Trash2,
} from "lucide-react";

/**
 * PayrollManagement.jsx
 * Admin-only payroll management UI with:
 * - Live summary cards (server endpoint)
 * - All / Pending tabs
 * - Search & role filter
 * - Approve, Adjust (confirm), View Details, Lock/Unlock
 *
 * Expects available endpoints:
 * GET  /api/admin/payroll-summary
 * GET  /api/payroll/all
 * GET  /api/payroll/unapproved
 * PUT  /api/payroll/:id/approve
 * PUT  /api/payroll/:id/adjust
 */

export default function PayrollManagement() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  // ADMIN-only guard
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return (
      <div
        className={`flex flex-col items-center justify-center min-h-screen ${
          dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
        }`}
      >
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-sm opacity-70">You do not have permission to view this page.</p>
      </div>
    );
  }

  // state
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalPayrolls: 0,
    approvedCount: 0,
    pendingCount: 0,
    totalPayout: 0,
  });
  const [allPayrolls, setAllPayrolls] = useState([]);
  const [pendingPayrolls, setPendingPayrolls] = useState([]);
  const [approvedPayrolls, setApprovedPayrolls] = useState([]);

  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'pending' | 'approved' | 'weekly-summary'
  const [searchValue, setSearchValue] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // 'all'|'admin'|'supervisor'|'teller'
  const [hideZero, setHideZero] = useState(false); // hide entries with zero/negative total
  const [dateFilter, setDateFilter] = useState("overall"); // 'overall' | specific date string
  const [selectedDate, setSelectedDate] = useState(""); // for date picker
  const [consolidateMode, setConsolidateMode] = useState("none"); // 'none' | 'weekly' | 'monthly'
  const [weeklyPayrollData, setWeeklyPayrollData] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, 1 = next week
  const [dailyDetailModal, setDailyDetailModal] = useState({ open: false, payroll: null, userName: '', date: '' });
  const [payoutFilter, setPayoutFilter] = useState(() => {
    return localStorage.getItem('payoutFilter') || 'overall';
  }); // 'overall' | 'daily' | 'weekly' | 'monthly'
  const [payoutDate, setPayoutDate] = useState(() => {
    return localStorage.getItem('payoutDate') || new Date().toISOString().split('T')[0];
  }); // date for payout filter
  const [totalPayrollFilter, setTotalPayrollFilter] = useState(() => {
    return localStorage.getItem('totalPayrollFilter') || 'daily';
  }); // 'daily' | 'weekly' | 'monthly'
  const [totalPayrollDate, setTotalPayrollDate] = useState(() => {
    return localStorage.getItem('totalPayrollDate') || new Date().toISOString().split('T')[0];
  }); // date for total payroll filter

  // modals & forms
  const [viewPayroll, setViewPayroll] = useState(null);
  const [adjustModal, setAdjustModal] = useState({ open: false, payroll: null });
  const [confirmAdjust, setConfirmAdjust] = useState({ open: false, payroll: null, payload: null });
  const [overrideModal, setOverrideModal] = useState({ open: false, payroll: null });
  const [createOverrideModal, setCreateOverrideModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [adjustKind, setAdjustKind] = useState("add"); // 'add' | 'deduct'
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustPaymentTerms, setAdjustPaymentTerms] = useState("");
  const [overrideAmount, setOverrideAmount] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideBaseSalary, setOverrideBaseSalary] = useState("");
  const [dailyReports, setDailyReports] = useState([]);

  // Create override fields
  const [selectedUserId, setSelectedUserId] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createBaseSalary, setCreateBaseSalary] = useState("");
  const [createOver, setCreateOver] = useState("");
  const [createShort, setCreateShort] = useState("");
  const [createShortPaymentTerms, setCreateShortPaymentTerms] = useState("1");
  const [createReason, setCreateReason] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCards, setSelectedCards] = useState([]); // For bulk printing
  const [cardsPerPage, setCardsPerPage] = useState(4); // Number of cards per A4 page

  // fetch data
  useEffect(() => {
    fetchAllData();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payoutFilter, payoutDate]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/users`);
      setUsersList(res.data?.users || res.data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  // real-time listener
  useEffect(() => {
    const events = ["payrollUpdated", "payrollApproved", "payrollDisapproved", "payrollAdjusted", "payrollLocked", "payrollDeleted"];
    const socket = getGlobalSocket();
    if (socket) {
      events.forEach((ev) =>
        socket.on(ev, () => {
          console.log("🔄 Payroll event:", ev);
          fetchAllData();
          showToast({ type: "info", message: "Payroll auto-refreshed" });
        })
      );
      return () => events.forEach((ev) => socket.off(ev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Build query params for summary endpoint
      const summaryParams = new URLSearchParams();
      if (payoutFilter !== 'overall') {
        summaryParams.append('filter', payoutFilter);
        summaryParams.append('date', payoutDate);
      }
      
      const [summaryRes, allRes, pendingRes] = await Promise.all([
        axios.get(`${getApiUrl()}/api/admin/payroll-summary?${summaryParams.toString()}`),
        axios.get(`${getApiUrl()}/api/payroll/all`),
        axios.get(`${getApiUrl()}/api/payroll/unapproved`),
      ]);

      const s = summaryRes.data || {};
      setSummary({
        totalPayrolls: s.totalPayrolls ?? s.totalRecords ?? 0,
        approvedCount: s.approvedCount ?? 0,
        pendingCount: s.pendingCount ?? (pendingRes.data?.unapproved?.length ?? 0),
        totalPayout: s.totalPayout ?? s.totalNet ?? 0,
      });

      // tolerate multiple shapes
      setAllPayrolls(allRes.data?.payrolls ?? allRes.data ?? []);
      setPendingPayrolls(
        pendingRes.data?.unapproved ?? pendingRes.data?.requests ?? pendingRes.data?.payrolls ?? []
      );
      
      // Extract approved payrolls from all payrolls
      const approved = (allRes.data?.payrolls ?? allRes.data ?? []).filter(p => p.approved);
      setApprovedPayrolls(approved);
    } catch (err) {
      console.error("Error loading payroll management data:", err);
      showToast({ type: "error", message: "Failed to load payroll management data." });
    } finally {
      setLoading(false);
    }
  };

  // refresh helper called after actions
  const refreshAll = async () => {
    await fetchAllData();
    if (activeTab === "weekly-summary") {
      await fetchWeeklyPayrollData(weekOffset);
    }
  };

  const fetchWeeklyPayrollData = async (offset = 0) => {
    try {
      // Get current week's start and end dates (Monday to Sunday)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days, else go back to Monday
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - daysFromMonday + (offset * 7)); // Start of week (Monday) + offset in weeks
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // End of week (Sunday)
      endOfWeek.setHours(23, 59, 59, 999);

      // Fetch all payrolls for this week
      const payrollRes = await axios.get(`${getApiUrl()}/api/payroll/all`);
      const allPayrolls = payrollRes.data?.payrolls ?? payrollRes.data ?? [];

      // Filter to this week's payrolls
      const weekPayrolls = allPayrolls.filter(p => {
        const payrollDate = new Date(p.createdAt || p.date);
        return payrollDate >= startOfWeek && payrollDate <= endOfWeek;
      });

      // Group by user and calculate totals
      const userTotals = {};
      
      for (const payroll of weekPayrolls) {
        const userId = payroll.user?._id || payroll.user;
        if (!userId) continue;

        if (!userTotals[userId]) {
          userTotals[userId] = {
            userId,
            userName: payroll.user?.name || payroll.user?.username || "Unknown",
            username: payroll.user?.username || "unknown",
            role: payroll.role,
            totalBaseSalary: 0,
            totalOver: 0,
            totalShort: 0,
            totalDeductions: 0,
            totalAdjustments: 0, // Track adjustments separately
            adjustmentsList: [], // Store individual adjustments with reasons
            weeklyPaymentDeductions: 0,
            shortPaymentPlans: [], // Store payment plan details
            totalGross: 0,
            totalNet: 0,
            daysWorked: 0,
            payrolls: [],
          };
        }

        const base = payroll.baseSalary || 0;
        const over = payroll.over || 0;
        const short = payroll.short || 0;
        const deduction = payroll.deduction || 0;
        const total = payroll.totalSalary || (base + over - short);
        
        // Calculate total adjustments delta for this payroll
        const adjustmentsDelta = payroll.adjustments?.reduce((sum, adj) => sum + (adj.delta || 0), 0) || 0;
        
        // Collect adjustment details
        if (payroll.adjustments && payroll.adjustments.length > 0) {
          payroll.adjustments.forEach(adj => {
            userTotals[userId].adjustmentsList.push({
              delta: adj.delta || 0,
              reason: adj.reason || 'No reason provided',
              createdAt: adj.createdAt,
              date: new Date(payroll.createdAt || payroll.date).toLocaleDateString()
            });
          });
        }

        userTotals[userId].totalBaseSalary += base;
        userTotals[userId].totalOver += over;
        userTotals[userId].totalShort += short;
        userTotals[userId].totalDeductions += deduction;
        userTotals[userId].totalAdjustments += adjustmentsDelta;
        userTotals[userId].totalGross += (base + over - short);
        userTotals[userId].totalNet += total;
        userTotals[userId].daysWorked += 1;
        userTotals[userId].payrolls.push(payroll);
      }

      // Fetch active payment plans to show weekly deductions
      const usersData = Object.values(userTotals);
      for (const userData of usersData) {
        try {
          const plansRes = await axios.get(`${getApiUrl()}/api/short-payments/active/${userData.userId}`);
          if (plansRes.data.success && plansRes.data.plans) {
            const weeklyDeduction = plansRes.data.plans.reduce((sum, plan) => sum + plan.weeklyAmount, 0);
            userData.weeklyPaymentDeductions = weeklyDeduction;
            userData.shortPaymentPlans = plansRes.data.plans.map(plan => ({
              amount: plan.weeklyAmount,
              remaining: plan.remainingWeeks,
              total: plan.totalAmount,
              original: plan.originalAmount
            }));
          }
        } catch (err) {
          console.error("Error fetching payment plans:", err);
        }
      }

      setWeeklyPayrollData(usersData);
    } catch (err) {
      console.error("Error fetching weekly payroll data:", err);
      showToast({ type: "error", message: "Failed to load weekly payroll data." });
    }
  };

  // Fetch weekly data when tab changes
  useEffect(() => {
    if (activeTab === "weekly-summary") {
      fetchWeeklyPayrollData(weekOffset);
    }
  }, [activeTab, weekOffset]);

  // SAFEGUARD: ensure we always filter arrays
  const filteredList = useMemo(() => {
    let list = activeTab === "all" ? allPayrolls : activeTab === "approved" ? approvedPayrolls : pendingPayrolls;

    if (!Array.isArray(list)) {
      console.warn("⚠️ PayrollManagement expected array, got:", list);
      list = [];
    }

    const q = searchValue.trim().toLowerCase();
    const byText = list.filter((p) => {
      if (roleFilter !== "all" && p.role !== roleFilter) return false;
      if (!q) return true;
      const name = (p.user?.name || p.user?.username || "").toLowerCase();
      const username = (p.user?.username || "").toLowerCase();
      return name.includes(q) || username.includes(q);
    });

    // Apply date filter
    const byDate = dateFilter !== "overall" ? byText.filter((p) => {
      const payrollDate = new Date(p.createdAt || p.date);
      const filterDate = new Date(dateFilter);
      return (
        payrollDate.getFullYear() === filterDate.getFullYear() &&
        payrollDate.getMonth() === filterDate.getMonth() &&
        payrollDate.getDate() === filterDate.getDate()
      );
    }) : byText;

    if (!hideZero) return byDate;
    // compute a robust total to determine visibility
    return byDate.filter((p) => {
      const base = (p.baseSalary ?? p.base ?? 0) || 0;
      const over = p.over ?? 0;
      const short = p.short ?? 0;
      const deduction = (p.deduction ?? p.totalDeductions ?? 0) || 0;
      const computed = (p.totalSalary ?? (base + over - short - deduction)) || 0;
      return computed > 0;
    });
  }, [activeTab, allPayrolls, approvedPayrolls, pendingPayrolls, searchValue, roleFilter, dateFilter]);

  // Calculate total payroll based on filter
  const totalPayrollAmount = useMemo(() => {
    if (!allPayrolls || allPayrolls.length === 0) return 0;
    
    let filtered = allPayrolls;
    
    if (totalPayrollFilter === 'daily') {
      filtered = allPayrolls.filter(p => {
        const payrollDate = new Date(p.createdAt || p.date);
        if (isNaN(payrollDate.getTime())) return false;
        return payrollDate.toISOString().split('T')[0] === totalPayrollDate;
      });
    } else if (totalPayrollFilter === 'weekly') {
      const targetDate = new Date(totalPayrollDate);
      const dayOfWeek = targetDate.getDay();
      const monday = new Date(targetDate);
      monday.setDate(targetDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      
      filtered = allPayrolls.filter(p => {
        const payrollDate = new Date(p.createdAt || p.date);
        if (isNaN(payrollDate.getTime())) return false;
        return payrollDate >= monday && payrollDate <= sunday;
      });
    } else if (totalPayrollFilter === 'monthly') {
      const [year, month] = totalPayrollDate.split('-');
      filtered = allPayrolls.filter(p => {
        const payrollDate = new Date(p.createdAt || p.date);
        if (isNaN(payrollDate.getTime())) return false;
        return payrollDate.getFullYear() === parseInt(year) && 
               (payrollDate.getMonth() + 1) === parseInt(month);
      });
    }
    
    return filtered.reduce((sum, p) => sum + (p.totalSalary || 0), 0);
  }, [allPayrolls, totalPayrollFilter, totalPayrollDate]);

  // Consolidated view (weekly or monthly per user)
  const consolidatedList = useMemo(() => {
    if (consolidateMode === 'none') return filteredList;
    const groups = new Map();

    for (const p of filteredList) {
      const d = new Date(p.createdAt || p.date);
      let periodKey;
      
      if (consolidateMode === 'monthly') {
        // Monthly: YYYY-MM
        periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      } else if (consolidateMode === 'weekly') {
        // Weekly: Get Monday of the week as YYYY-MM-DD
        const dayOfWeek = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        periodKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      }
      
      const key = `${p.user?._id || p.user}|${periodKey}`;
      if (!groups.has(key)) {
        groups.set(key, {
          _id: key,
          user: p.user,
          role: p.role,
          period: periodKey,
          baseSalary: 0,
          over: 0,
          short: 0,
          deduction: 0,
          totalSalary: 0,
          daysPresent: 0,
          approved: true, // will turn false if any item pending
          locked: false,  // true if any locked
        });
      }
      const g = groups.get(key);
      g.baseSalary += Number(p.baseSalary ?? p.base ?? 0) || 0;
      g.over += Number(p.over ?? 0) || 0;
      g.short += Number(p.short ?? 0) || 0;
      g.deduction += Number(p.deduction ?? p.totalDeductions ?? 0) || 0;
      g.totalSalary += Number(p.totalSalary ?? 0) || 0;
      g.daysPresent += Number(p.daysPresent ?? 1) || 0;
      // Accumulate adjustments for display
      if (p.adjustments && Array.isArray(p.adjustments)) {
        p.adjustments.forEach(adj => {
          // Store adjustments array for later display
          if (!g.adjustments) g.adjustments = [];
          g.adjustments.push(adj);
        });
      }
      if (!p.approved) g.approved = false;
      if (p.locked) g.locked = true;
    }

    // Convert to array and sort by user then period desc
    const arr = Array.from(groups.values());
    arr.sort((a, b) => {
      const nameA = (a.user?.name || a.user?.username || '').toLowerCase();
      const nameB = (b.user?.name || b.user?.username || '').toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return b.period.localeCompare(a.period);
    });
    return arr;
  }, [filteredList, consolidateMode]);

  // Calculate totals for the current view
  const viewTotals = useMemo(() => {
    const list = consolidateMode === 'none' ? filteredList : consolidatedList;
    const approvedItems = list.filter(p => p.approved);
    
    // Group by date for daily breakdown
    const byDate = new Map();
    
    list.forEach(p => {
      const dateStr = new Date(p.createdAt || p.date).toLocaleDateString();
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, {
          date: dateStr,
          records: 0,
          approved: 0,
          pending: 0,
          totalPayout: 0,
          base: 0,
          over: 0,
          short: 0,
        });
      }
      const d = byDate.get(dateStr);
      d.records++;
      if (p.approved) {
        d.approved++;
        d.totalPayout += Number(p.totalSalary) || 0;
      } else {
        d.pending++;
      }
      d.base += Number(p.baseSalary) || 0;
      d.over += Number(p.over) || 0;
      d.short += Number(p.short) || 0;
    });
    
    // Convert to sorted array (most recent first)
    const dailyBreakdown = Array.from(byDate.values()).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );
    
    return {
      totalRecords: list.length,
      approvedRecords: approvedItems.length,
      pendingRecords: list.length - approvedItems.length,
      totalPayout: approvedItems.reduce((sum, p) => sum + (Number(p.totalSalary) || 0), 0),
      totalBase: list.reduce((sum, p) => sum + (Number(p.baseSalary) || 0), 0),
      totalOver: list.reduce((sum, p) => sum + (Number(p.over) || 0), 0),
      totalShort: list.reduce((sum, p) => sum + (Number(p.short) || 0), 0),
      dailyBreakdown,
    };
  }, [filteredList, consolidatedList, consolidateMode]);

  // helper for status badge
  const statusBadge = (p) => {
    if (p.locked) return { color: "bg-gray-600 text-white", text: "Locked" };
    if (!p.approved) return { color: "bg-yellow-400 text-black", text: "Pending" };
    if (p.approved) return { color: "bg-green-500 text-white", text: "Approved" };
    return { color: "bg-gray-400 text-white", text: "Unknown" };
  };

  // ACTIONS
  const handleApprove = async (payroll) => {
    if (!payroll?._id) return;
    const ok = confirm(`Approve payroll for ${payroll.user?.name || payroll.user?.username || "user"}?`);
    if (!ok) return;
    try {
      setProcessing(true);
      await axios.put(`${getApiUrl()}/api/payroll/${payroll._id}/approve`, { adminId: user?._id });
      showToast({ type: "success", message: "Payroll approved." });
      // emit socket event so other tabs can refresh (optional)
      try { const socket = getGlobalSocket(); if (socket) socket.emit("payrollApproved"); } catch (e) { /* ignore */ }
      await refreshAll();
    } catch (err) {
      console.error("Approve error", err);
      showToast({ type: "error", message: "Failed to approve payroll." });
    } finally {
      setProcessing(false);
    }
  };

  const handleDisapprove = async (payroll) => {
    if (!payroll?._id) return;
    const ok = confirm(`Set payroll to pending for ${payroll.user?.name || payroll.user?.username || "user"}? This will exclude it from total payout.`);
    if (!ok) return;
    try {
      setProcessing(true);
      await axios.put(`${getApiUrl()}/api/payroll/${payroll._id}/disapprove`, { adminId: user?._id });
      showToast({ type: "success", message: "Payroll set to pending." });
      try { const socket = getGlobalSocket(); if (socket) socket.emit("payrollDisapproved"); } catch (e) { /* ignore */ }
      await refreshAll();
    } catch (err) {
      console.error("Disapprove error", err);
      showToast({ type: "error", message: "Failed to disapprove payroll." });
    } finally {
      setProcessing(false);
    }
  };

  const openAdjustModal = (payroll) => {
    setAdjustModal({ open: true, payroll });
    setAdjustKind("add");
    setAdjustAmount("");
    setAdjustReason("");
    setAdjustPaymentTerms(payroll.shortPaymentTerms || "1");
  };

  const handleAdjustProceed = () => {
    const amount = parseFloat(adjustAmount);
    
    // Allow proceeding if either:
    // 1. Valid amount is provided, OR
    // 2. Payment terms are being changed (for payrolls with shorts)
    const hasValidAmount = !isNaN(amount) && amount > 0;
    const hasPaymentTermsChange = adjustModal.payroll?.short > 0 && adjustPaymentTerms;
    
    if (!hasValidAmount && !hasPaymentTermsChange) {
      showToast({ type: "warning", message: "Enter a valid amount or set payment terms." });
      return;
    }
    
    const delta = hasValidAmount ? (adjustKind === "add" ? Math.abs(amount) : -Math.abs(amount)) : 0;
    setConfirmAdjust({ open: true, payroll: adjustModal.payroll, payload: { delta, reason: adjustReason } });
  };

  const confirmAdjustFinal = async () => {
    const { payload, payroll } = confirmAdjust;
    if (!payroll || !payload) return;
    try {
      setProcessing(true);
      const adjustData = {
        delta: payload.delta,
        reason: payload.reason || "",
        adminId: user?._id,
      };
      
      // Always include payment terms if they were changed
      if (adjustPaymentTerms && adjustPaymentTerms !== String(payroll.shortPaymentTerms || 1)) {
        adjustData.shortPaymentTerms = parseInt(adjustPaymentTerms) || 1;
      }
      
      await axios.put(`${getApiUrl()}/api/payroll/${payroll._id}/adjust`, adjustData);
      
      // Create payment plan if short exists and payment terms > 1
      if (payroll.short > 0 && adjustPaymentTerms && parseInt(adjustPaymentTerms) > 1) {
        try {
          await axios.post(`${getApiUrl()}/api/short-payments/create`, {
            userId: payroll.user._id,
            originPayrollId: payroll._id,
            totalAmount: payroll.short,
            weeksTotal: parseInt(adjustPaymentTerms),
            startDate: new Date(),
            note: `Payment plan set by admin: ${payload.reason || 'Payment terms adjusted'}`,
          });
          console.log(`✅ Created payment plan for ${payroll.user?.name || payroll.user?.username}`);
        } catch (planErr) {
          console.error("Failed to create payment plan:", planErr);
        }
      }
      
      showToast({
        type: "success",
        message: `Adjusted ₱${payload.delta.toFixed(2)} for ${payroll.user?.name || payroll.user?.username}.`,
      });
      // emit socket event so other tabs can refresh (optional)
      try { const socket = getGlobalSocket(); if (socket) socket.emit("payrollAdjusted"); } catch (e) { /* ignore */ }
      setConfirmAdjust({ open: false, payroll: null, payload: null });
      setAdjustModal({ open: false, payroll: null });
      await refreshAll();
    } catch (err) {
      console.error("Adjust error:", err);
      showToast({ type: "error", message: "Failed to adjust payroll." });
    } finally {
      setProcessing(false);
    }
  };

  const toggleLock = async (payroll) => {
    if (!payroll) return;
    const willLock = !payroll.locked;
    const confirmMsg = willLock
      ? `Lock payroll for ${payroll.user?.name || payroll.user?.username}? Locked payroll cannot be edited.`
      : `Unlock payroll for ${payroll.user?.name || payroll.user?.username}?`;
    if (!confirm(confirmMsg)) return;
    try {
      setProcessing(true);
      // uses adjust endpoint as a simple toggle action (delta = 0, reason notes lock)
      await axios.put(`${getApiUrl()}/api/payroll/${payroll._id}/adjust`, {
        delta: 0,
        reason: willLock ? "Locked by admin" : "Unlocked by admin",
        adminId: user?._id,
      });
      // emit socket event so other tabs can refresh (optional)
      try { const socket = getGlobalSocket(); if (socket) socket.emit("payrollLocked"); } catch (e) { /* ignore */ }
      await refreshAll();
      showToast({ type: "success", message: willLock ? "Payroll locked." : "Payroll unlocked." });
    } catch (err) {
      console.error("Lock/Unlock error", err);
      showToast({ type: "error", message: "Failed to toggle lock." });
    } finally {
      setProcessing(false);
    }
  };

  const deletePayroll = async (payroll) => {
    if (!payroll) return;
    const confirmMsg = `Are you sure you want to delete payroll for ${payroll.user?.name || payroll.user?.username}?\n\nThis action cannot be undone!`;
    if (!confirm(confirmMsg)) return;
    try {
      setProcessing(true);
      await axios.delete(`${getApiUrl()}/api/payroll/${payroll._id}`);
      // emit socket event so other tabs can refresh
      try { const socket = getGlobalSocket(); if (socket) socket.emit("payrollDeleted"); } catch (e) { /* ignore */ }
      await refreshAll();
      showToast({ type: "success", message: "Payroll deleted successfully." });
    } catch (err) {
      console.error("Delete payroll error", err);
      showToast({ type: "error", message: err.response?.data?.message || "Failed to delete payroll." });
    } finally {
      setProcessing(false);
    }
  };

  const openViewDetails = (payroll) => setViewPayroll(payroll);

  const openOverrideModal = (payroll) => {
    // Don't allow override on consolidated records
    if (consolidateMode !== 'none' && payroll._id && typeof payroll._id === 'string' && payroll._id.includes('|')) {
      showToast({ 
        type: "warning", 
        message: "Cannot override consolidated records. Set view to 'Daily' to override individual payrolls." 
      });
      return;
    }
    setOverrideModal({ open: true, payroll });
    setOverrideAmount("");
    setOverrideReason("");
    setOverrideBaseSalary(payroll.baseSalary?.toString() || "");
    // Set default date to payroll's date
    const payrollDate = new Date(payroll.createdAt || payroll.date);
    setOverrideDate(payrollDate.toISOString().split('T')[0]);
  };

  const handleOverride = async () => {
    const amount = parseFloat(overrideAmount);
    if (isNaN(amount) || amount === 0) {
      showToast({ type: "warning", message: "Enter a valid amount (can be positive or negative)." });
      return;
    }
    if (!overrideReason.trim()) {
      showToast({ type: "warning", message: "Please provide a reason for this override." });
      return;
    }

    const baseSalary = parseFloat(overrideBaseSalary);
    if (isNaN(baseSalary) || baseSalary < 0) {
      showToast({ type: "warning", message: "Please enter a valid base salary." });
      return;
    }

    const { payroll } = overrideModal;
    if (!payroll) return;

    try {
      setProcessing(true);
      await axios.put(`${getApiUrl()}/api/payroll/${payroll._id}/adjust`, {
        delta: amount,
        baseSalary: baseSalary,
        reason: `[OVERRIDE] ${overrideReason} (Date: ${new Date(overrideDate).toLocaleDateString()})`,
        adminId: user?._id,
        overrideDate: overrideDate,
      });
      showToast({
        type: "success",
        message: `Override applied: ${amount >= 0 ? '+' : ''}₱${amount.toFixed(2)} for ${payroll.user?.name || payroll.user?.username} on ${new Date(overrideDate).toLocaleDateString()}.`,
      });
      try { const socket = getGlobalSocket(); if (socket) socket.emit("payrollAdjusted"); } catch (e) { /* ignore */ }
      setOverrideModal({ open: false, payroll: null });
      await refreshAll();
    } catch (err) {
      console.error("Override error:", err);
      showToast({ type: "error", message: "Failed to apply override." });
    } finally {
      setProcessing(false);
    }
  };

  const openCreateOverrideModal = () => {
    setCreateOverrideModal(true);
    setSelectedUserId("");
    setCreateDate(new Date().toISOString().split('T')[0]);
    setCreateBaseSalary("");
    setCreateOver("");
    setCreateShort("");
    setCreateShortPaymentTerms("1");
    setCreateReason("");
    setSelectedDates([]);
    setStartDate("");
    setEndDate("");
  };

  const generateDateRange = (start, end) => {
    if (!start || !end) return [];
    const dates = [];
    const startD = new Date(start);
    const endD = new Date(end);
    
    if (startD > endD) return [];
    
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0]);
    }
    return dates;
  };

  const handleStartDateChange = (date) => {
    setStartDate(date);
    if (date && endDate) {
      const range = generateDateRange(date, endDate);
      setSelectedDates(range);
    }
  };

  const handleEndDateChange = (date) => {
    setEndDate(date);
    if (startDate && date) {
      const range = generateDateRange(startDate, date);
      setSelectedDates(range);
    }
  };

  const toggleDate = (date) => {
    setSelectedDates(prev => 
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const handleCreateOverride = async () => {
    if (!selectedUserId) {
      showToast({ type: "warning", message: "Please select a user." });
      return;
    }
    if (selectedDates.length === 0) {
      showToast({ type: "warning", message: "Please select at least one date." });
      return;
    }
    if (!createBaseSalary || parseFloat(createBaseSalary) <= 0) {
      showToast({ type: "warning", message: "Please enter a valid base salary." });
      return;
    }
    if (!createReason.trim()) {
      showToast({ type: "warning", message: "Please provide a reason for this override." });
      return;
    }

    try {
      setProcessing(true);
      const selectedUser = usersList.find(u => u._id === selectedUserId);
      let successCount = 0;
      let failCount = 0;
      
      for (const date of selectedDates) {
        try {
          const response = await axios.post(`${getApiUrl()}/api/payroll/create-override`, {
            userId: selectedUserId,
            date: date,
            baseSalary: parseFloat(createBaseSalary),
            over: parseFloat(createOver) || 0,
            short: parseFloat(createShort) || 0,
            shortPaymentTerms: parseInt(createShortPaymentTerms) || 1,
            reason: createReason,
            role: selectedUser?.role || 'teller',
            adminId: user?._id,
          });
          
          // Create payment plan if short with payment terms > 1
          const shortAmount = parseFloat(createShort) || 0;
          const paymentTerms = parseInt(createShortPaymentTerms) || 1;
          if (shortAmount > 0 && paymentTerms > 1 && response.data?.payroll) {
            try {
              await axios.post(`${getApiUrl()}/api/short-payments/create`, {
                userId: selectedUserId,
                originPayrollId: response.data.payroll._id,
                totalAmount: shortAmount,
                weeksTotal: paymentTerms,
                startDate: date,
                note: `Payment plan from admin override: ${createReason}`,
              });
              console.log(`✅ Created payment plan for ${selectedUser?.name || selectedUser?.username}`);
            } catch (planErr) {
              console.error("Failed to create payment plan:", planErr);
            }
          }
          
          successCount++;
        } catch (err) {
          console.error(`Failed to create override for ${date}:`, err);
          failCount++;
        }
      }
      
      if (successCount > 0) {
        showToast({
          type: "success",
          message: `Created ${successCount} payroll override(s) for ${selectedUser?.name || selectedUser?.username}.${failCount > 0 ? ` ${failCount} failed (may already exist).` : ''}`,
        });
      } else {
        showToast({
          type: "error",
          message: "Failed to create overrides. Payrolls may already exist for these dates.",
        });
      }
      
      try { const socket = getGlobalSocket(); if (socket) socket.emit("payrollAdjusted"); } catch (e) { /* ignore */ }
      setCreateOverrideModal(false);
      await refreshAll();
    } catch (err) {
      console.error("Create override error:", err);
      showToast({ type: "error", message: err.response?.data?.message || "Failed to create override." });
    } finally {
      setProcessing(false);
    }
  };

  // Fetch daily reports for teller when viewing details
  useEffect(() => {
    if (viewPayroll && viewPayroll.role === "teller") {
      fetchDailyReports(viewPayroll.user._id);
    } else {
      setDailyReports([]);
    }
  }, [viewPayroll]);

  const fetchDailyReports = async (userId) => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/teller-reports/teller/${userId}`);
      // Normalize response: some endpoints return { reports: [...] } or { tellers: [...] }
      let data = [];
      if (!res || !res.data) data = [];
      else if (Array.isArray(res.data)) data = res.data;
      else if (Array.isArray(res.data.reports)) data = res.data.reports;
      else if (Array.isArray(res.data.tellers)) data = res.data.tellers;
      else if (Array.isArray(res.data.items)) data = res.data.items;
      else data = [];

      // Filter to current month and group by day
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const filtered = data.filter((report) => {
        const reportDate = new Date(report.date || report.createdAt);
        return reportDate >= monthStart && reportDate <= monthEnd;
      });

      setDailyReports(filtered);
    } catch (err) {
      console.error("Error fetching daily reports:", err);
      setDailyReports([]);
    }
  };

  const cardClass = (extra = "") => `p-4 rounded-xl shadow-md transition transform hover:-translate-y-1 ${extra}`;

  return (
    <div className={`p-6 min-h-screen ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Payroll Management</h1>
          <p className="text-sm opacity-70">Overview, approve, and manually adjust payrolls.</p>
        </div>
        {(user?.role === "admin" || user?.role === "super_admin") && (
          <button
            onClick={openCreateOverrideModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition"
          >
            <DollarSign className="w-4 h-4" />
            Create Override
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className={cardClass(dark ? "bg-gray-800" : "bg-white")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Total Payrolls
              </div>
              <div className="text-2xl font-bold">{summary.totalPayrolls ?? 0}</div>
            </div>
            <div className="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-100">
              <ClipboardList />
            </div>
          </div>
        </div>

        <div className={cardClass(dark ? "bg-gray-800" : "bg-white")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Approved
              </div>
              <div className="text-2xl font-bold">{summary.approvedCount ?? 0}</div>
            </div>
            <div className="p-3 rounded-lg bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100">
              <CheckCircle />
            </div>
          </div>
        </div>

        <div className={cardClass(dark ? "bg-gray-800" : "bg-white")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Pending
              </div>
              <div className="text-2xl font-bold">{summary.pendingCount ?? 0}</div>
            </div>
            <div className="p-3 rounded-lg bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-100">
              <Clock />
            </div>
          </div>
        </div>

        <div className={cardClass(dark ? "bg-gray-800" : "bg-white")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Total Payroll
              </div>
              <div className="text-2xl font-bold">₱{totalPayrollAmount.toLocaleString()}</div>
              <div className="mt-2 flex items-center gap-2">
                <select 
                  value={totalPayrollFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTotalPayrollFilter(val);
                    localStorage.setItem('totalPayrollFilter', val);
                  }}
                  className={`text-xs px-2 py-1 rounded border ${dark ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"}`}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <input 
                  type="date"
                  value={totalPayrollDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTotalPayrollDate(val);
                    localStorage.setItem('totalPayrollDate', val);
                  }}
                  className={`text-xs px-2 py-1 rounded border ${dark ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"}`}
                />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-700 text-purple-700 dark:text-purple-100">
              <DollarSign />
            </div>
          </div>
        </div>

        <div className={cardClass(dark ? "bg-gray-800" : "bg-white")}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Total Payout
              </div>
              <div className="text-2xl font-bold">₱{(summary.totalPayout ?? 0).toLocaleString()}</div>
              <div className="mt-2 flex items-center gap-2">
                <select 
                  value={payoutFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPayoutFilter(val);
                    localStorage.setItem('payoutFilter', val);
                  }}
                  className={`text-xs px-2 py-1 rounded border ${dark ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"}`}
                >
                  <option value="overall">Overall</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {payoutFilter !== 'overall' && (
                  <input 
                    type="date"
                    value={payoutDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPayoutDate(val);
                      localStorage.setItem('payoutDate', val);
                    }}
                    className={`text-xs px-2 py-1 rounded border ${dark ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"}`}
                  />
                )}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-100">
              <DollarSign />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-4 items-start lg:items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeTab === "all" ? "bg-indigo-600 text-white" : dark ? "bg-gray-800 text-gray-200" : "bg-white text-gray-700"
            }`}
          >
            All Payrolls
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeTab === "pending" ? "bg-indigo-600 text-white" : dark ? "bg-gray-800 text-gray-200" : "bg-white text-gray-700"
            }`}
          >
            Pending Payrolls
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeTab === "approved" ? "bg-indigo-600 text-white" : dark ? "bg-gray-800 text-gray-200" : "bg-white text-gray-700"
            }`}
          >
            Approved Payrolls
          </button>
          <button
            onClick={() => setActiveTab("weekly-summary")}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeTab === "weekly-summary" ? "bg-indigo-600 text-white" : dark ? "bg-gray-800 text-gray-200" : "bg-white text-gray-700"
            }`}
          >
            Weekly Summary
          </button>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${dark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
            <Search className="w-4 h-4 text-gray-400" />
            <input value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder="Search name or username..." className="bg-transparent outline-none text-sm" />
          </div>

          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${dark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-transparent outline-none text-sm">
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="supervisor">Supervisor</option>
              <option value="supervisor_teller">Supervisor/Teller</option>
              <option value="head_watcher">Head Watcher</option>
              <option value="sub_watcher">Sub Watcher</option>
              <option value="teller">Teller</option>
            </select>
          </div>

          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${dark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
            <Calendar className="w-4 h-4 text-gray-400" />
            <select 
              value={dateFilter} 
              onChange={(e) => {
                const value = e.target.value;
                setDateFilter(value);
                if (value === "overall") setSelectedDate("");
                else if (value === "custom") {
                  // Keep current selectedDate or empty
                } else {
                  setSelectedDate(value);
                }
              }} 
              className="bg-transparent outline-none text-sm min-w-[140px]"
            >
              <option value="overall">Overall (All Dates)</option>
              <option value={new Date().toISOString().split('T')[0]}>Today</option>
              <option value={new Date(Date.now() - 86400000).toISOString().split('T')[0]}>Yesterday</option>
              <option value="custom">Custom Date...</option>
            </select>
          </div>

          {dateFilter === "custom" && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${dark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedDate(value);
                  setDateFilter(value); // Update dateFilter to trigger the filter
                }}
                className="bg-transparent outline-none text-sm"
              />
            </div>
          )}

          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${dark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
            <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
            <span className="text-sm select-none">Hide zero salary</span>
          </label>
        </div>
      </div>

      {/* Weekly Summary View - Receipt Style */}
      {activeTab === "weekly-summary" && (
        <div>
          {/* Header with Navigation */}
          <div className="mb-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Weekly Payroll Summary</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {(() => {
                  const now = new Date();
                  const dayOfWeek = now.getDay();
                  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                  const monday = new Date(now);
                  monday.setDate(now.getDate() - daysFromMonday + (weekOffset * 7));
                  const sunday = new Date(monday);
                  sunday.setDate(monday.getDate() + 6);
                  return `${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`;
                })()}
                {weekOffset === 0 && <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-semibold">(Current Week)</span>}
                {weekOffset < 0 && <span className="ml-2 text-gray-600 dark:text-gray-400">({Math.abs(weekOffset)} week{Math.abs(weekOffset) > 1 ? 's' : ''} ago)</span>}
                {weekOffset > 0 && <span className="ml-2 text-gray-600 dark:text-gray-400">({weekOffset} week{weekOffset > 1 ? 's' : ''} ahead)</span>}
              </p>
            </div>

            {/* Bulk Print Controls */}
            {selectedCards.length > 0 && (
              <div className="mb-4 p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-indigo-800 dark:text-indigo-300">
                    {selectedCards.length} card{selectedCards.length > 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={() => setSelectedCards([])}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Clear selection
                  </button>
                </div>
                <button
                  onClick={() => {
                    // Create A4 print window with multiple cards
                    const printWindow = window.open('', '', 'width=800,height=600');
                    if (printWindow) {
                      const now = new Date();
                      const dayOfWeek = now.getDay();
                      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                      const weekStart = new Date(now);
                      weekStart.setDate(now.getDate() - daysFromMonday + (weekOffset * 7));
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekStart.getDate() + 6);
                      
                      let cardsHTML = '';
                      selectedCards.forEach(userId => {
                        const item = weeklyPayrollData.find(d => d.userId === userId);
                        if (!item) return;
                        
                        let dailyHTML = '';
                        for (let i = 0; i < 7; i++) {
                          const currentDay = new Date(weekStart);
                          currentDay.setDate(weekStart.getDate() + i);
                          const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i];
                          const dayPayroll = item.payrolls.find(p => {
                            const pDate = new Date(p.createdAt || p.date);
                            // Normalize both dates to midnight for accurate comparison
                            const normalizedPayroll = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
                            const normalizedCurrent = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
                            return normalizedPayroll.getTime() === normalizedCurrent.getTime();
                          });
                          
                          if (dayPayroll) {
                            dailyHTML += `<div style="display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dotted #ccc;">
                              <span>${dayName} ${currentDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              <span style="font-weight: bold;">₱${(dayPayroll.totalSalary || 0).toFixed(2)}</span>
                            </div>`;
                          }
                        }
                        
                        cardsHTML += `
                        <div class="receipt-card">
                          <div class="header">
                            <p class="title">WEEKLY PAYROLL</p>
                            <p class="subtitle">${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}</p>
                          </div>
                          
                          <div class="section">
                            <div class="row">
                              <span style="font-weight: bold;">Employee:</span>
                              <span>${item.userName}</span>
                            </div>
                            <div class="row">
                              <span style="font-weight: bold;">Username:</span>
                              <span>@${item.username}</span>
                            </div>
                            <div class="row">
                              <span style="font-weight: bold;">Role:</span>
                              <span>${item.role.toUpperCase()}</span>
                            </div>
                          </div>
                          
                          <div class="section">
                            <div class="section-title">DAILY BREAKDOWN (${item.daysWorked} days)</div>
                            ${dailyHTML}
                          </div>
                          
                          <div class="section">
                            <div class="section-title">WEEKLY SUMMARY</div>
                            <div class="row">
                              <span>Base Salary:</span>
                              <span>₱${item.totalBaseSalary.toFixed(2)}</span>
                            </div>
                            ${item.totalOver > 0 ? `<div class="row"><span>Over:</span><span>+₱${item.totalOver.toFixed(2)}</span></div>` : ''}
                            ${item.totalShort > 0 ? `<div class="row"><span>Short:</span><span>-₱${item.totalShort.toFixed(2)}</span></div>` : ''}
                            ${item.totalDeductions > 0 ? `<div class="row"><span>Deduction:</span><span>-₱${item.totalDeductions.toFixed(2)}</span></div>` : ''}
                            ${item.weeklyPaymentDeductions > 0 ? `<div class="row"><span>Payment Plan:</span><span>-₱${item.weeklyPaymentDeductions.toFixed(2)}</span></div>` : ''}
                            ${item.shortPaymentPlans && item.shortPaymentPlans.length > 0 ? item.shortPaymentPlans.map(plan => `<div class="row" style="font-size: 7px; color: #666; padding-left: 5mm;"><span>₱${plan.amount.toFixed(2)}/week</span><span>${plan.remaining} weeks left</span></div>`).join('') : ''}
                            ${item.adjustmentsList && item.adjustmentsList.length > 0 ? `<div class="row" style="font-weight: bold; color: ${item.totalAdjustments >= 0 ? '#2563eb' : '#d97706'};"><span>Adjustments:</span><span>${item.totalAdjustments >= 0 ? '+' : ''}₱${item.totalAdjustments.toFixed(2)}</span></div>` : ''}
                            ${item.adjustmentsList && item.adjustmentsList.length > 0 ? item.adjustmentsList.map(adj => `<div class="row" style="font-size: 6px; color: #666; padding-left: 5mm;"><span>${adj.reason}</span><span style="color: ${adj.delta >= 0 ? '#2563eb' : '#d97706'};">${adj.delta >= 0 ? '+' : ''}₱${adj.delta.toFixed(2)}</span></div>`).join('') : ''}
                          </div>
                          
                          <div class="total-row">
                            <div class="row">
                              <span>NET PAY:</span>
                              <span>₱${item.totalNet.toFixed(2)}</span>
                            </div>
                          </div>
                          
                          <div class="footer">
                            <p>Generated: ${new Date().toLocaleString()}</p>
                            <p style="margin-top: 2mm;">Thank you!</p>
                          </div>
                        </div>
                        `;
                      });
                      
                      // Calculate dynamic layout based on cardsPerPage
                      const cols = cardsPerPage <= 2 ? 1 : 2; // 1 or 2 columns
                      const cardWidth = cols === 1 ? '90%' : `calc(${100 / cols}% - 5mm)`;
                      const fontSize = cardsPerPage <= 4 ? '8px' : cardsPerPage <= 6 ? '7px' : '6px';
                      const titleSize = cardsPerPage <= 4 ? '11px' : cardsPerPage <= 6 ? '10px' : '9px';
                      
                      printWindow.document.write(`
                        <html>
                        <head>
                          <title>Weekly Payroll - Multiple Receipts</title>
                          <style>
                            @page { size: A4; margin: 10mm; }
                            body { 
                              font-family: 'Courier New', monospace; 
                              padding: 0;
                              margin: 0;
                              display: flex;
                              flex-wrap: wrap;
                              justify-content: space-between;
                              align-content: flex-start;
                            }
                            .receipt-card {
                              width: ${cardWidth};
                              margin-bottom: ${cardsPerPage <= 4 ? '8mm' : '5mm'};
                              padding: 3mm;
                              border: 1px solid #ccc;
                              page-break-inside: avoid;
                              font-size: ${fontSize};
                              line-height: 1.3;
                              box-sizing: border-box;
                            }
                            .receipt-card:nth-child(${cardsPerPage}n) {
                              page-break-after: always;
                            }
                            .header {
                              text-align: center;
                              border-bottom: 2px solid #000;
                              padding-bottom: 3mm;
                              margin-bottom: 3mm;
                            }
                            .title { font-size: ${titleSize}; font-weight: bold; margin: 0; }
                            .subtitle { font-size: ${cardsPerPage <= 4 ? '7px' : '6px'}; margin: 2px 0; }
                            .section { margin: ${cardsPerPage <= 4 ? '3mm' : '2mm'} 0; padding: 2mm 0; border-bottom: 1px dashed #000; }
                            .section-title { font-weight: bold; margin-bottom: 2mm; font-size: ${cardsPerPage <= 4 ? '9px' : '8px'}; }
                            .row { display: flex; justify-content: space-between; padding: 1px 0; }
                            .total-row { 
                              font-weight: bold; 
                              font-size: ${cardsPerPage <= 4 ? '10px' : '9px'}; 
                              padding: 2mm 0;
                              border-top: 2px solid #000;
                              border-bottom: 2px solid #000;
                              margin-top: 2mm;
                            }
                            .footer { text-align: center; font-size: ${cardsPerPage <= 4 ? '7px' : '6px'}; margin-top: 3mm; padding-top: 2mm; border-top: 1px solid #000; }
                          </style>
                        </head>
                        <body>
                          ${cardsHTML}
                        </body>
                        </html>
                      `);
                      printWindow.document.close();
                      printWindow.focus();
                      setTimeout(() => {
                        printWindow.print();
                        printWindow.close();
                      }, 250);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print {selectedCards.length} Cards (A4)
                </button>
                <div className="flex items-center gap-2">
                  <label className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Cards per page:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={cardsPerPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 4;
                      setCardsPerPage(Math.min(Math.max(val, 1), 12));
                    }}
                    className={`w-16 px-2 py-1 rounded border text-center ${
                      dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                  <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    (1-12)
                  </span>
                </div>
              </div>
            )}

            {/* Week Navigation */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setWeekOffset(weekOffset - 1)}
                className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${
                  dark ? "bg-gray-800 text-gray-200 hover:bg-gray-700" : "bg-white text-gray-700 hover:bg-gray-50"
                } border ${dark ? "border-gray-700" : "border-gray-200"}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous Week
              </button>

              <button
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  weekOffset === 0
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                Current Week
              </button>

              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${
                  dark ? "bg-gray-800 text-gray-200 hover:bg-gray-700" : "bg-white text-gray-700 hover:bg-gray-50"
                } border ${dark ? "border-gray-700" : "border-gray-200"}`}
              >
                Next Week
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-400">Loading weekly summary...</div>
          ) : weeklyPayrollData.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No payroll data for this week.</div>
          ) : (
            <div>
              {/* Employee Cards in 3-column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {weeklyPayrollData.map((item) => {
                  // Get week start for daily breakdown
                  const now = new Date();
                  const dayOfWeek = now.getDay();
                  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                  const weekStart = new Date(now);
                  weekStart.setDate(now.getDate() - daysFromMonday + (weekOffset * 7));
                  
                  // Create daily breakdown array (Monday to Sunday)
                  const dailyBreakdown = [];
                  for (let i = 0; i < 7; i++) {
                    const currentDay = new Date(weekStart);
                    currentDay.setDate(weekStart.getDate() + i);
                    const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i];
                    
                    // Find payroll for this day - normalize dates to compare only date parts
                    const dayPayroll = item.payrolls.find(p => {
                      const pDate = new Date(p.createdAt || p.date);
                      // Normalize both dates to midnight for accurate comparison
                      const normalizedPayroll = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
                      const normalizedCurrent = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
                      return normalizedPayroll.getTime() === normalizedCurrent.getTime();
                    });
                    
                    dailyBreakdown.push({
                      day: dayName,
                      date: currentDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      payroll: dayPayroll,
                      hasData: !!dayPayroll
                    });
                  }
                  
                  return (
                    <div id={`receipt-${item.userId}`} key={item.userId} className={`receipt-card rounded-lg ${dark ? "bg-gray-800" : "bg-white"} shadow-lg p-4 border ${selectedCards.includes(item.userId) ? 'border-indigo-500 border-2' : dark ? "border-gray-700" : "border-gray-200"}`}>
                      {/* Selection Checkbox */}
                      <div className="flex items-center justify-end mb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCards.includes(item.userId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCards([...selectedCards, item.userId]);
                              } else {
                                setSelectedCards(selectedCards.filter(id => id !== item.userId));
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Select for printing</span>
                        </label>
                      </div>
                      
                      {/* Employee Header */}
                      <div className="border-b pb-3 mb-3">
                        <h4 className="text-lg font-bold">{item.userName}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">@{item.username}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded text-xs font-semibold">
                          {item.role}
                        </span>
                      </div>

                      {/* Daily Breakdown */}
                      <div className="mb-3">
                        <p className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-400">Daily Breakdown:</p>
                        <div className="space-y-1">
                          {dailyBreakdown.map((day, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => {
                                if (day.hasData) {
                                  setDailyDetailModal({
                                    open: true,
                                    payroll: day.payroll,
                                    userName: item.userName,
                                    date: `${day.day} ${day.date}`
                                  });
                                }
                              }}
                              className={`flex justify-between items-center text-xs py-1 px-2 rounded ${
                              day.hasData 
                                ? dark ? "bg-green-900/20 text-green-400 cursor-pointer hover:bg-green-900/30" : "bg-green-50 text-green-700 cursor-pointer hover:bg-green-100"
                                : dark ? "bg-gray-700/50 text-gray-500" : "bg-gray-50 text-gray-400"
                            }`}>
                              <span className="font-medium">{day.day} {day.date}</span>
                              {day.hasData ? (
                                <span className="font-bold">₱{day.payroll.totalSalary?.toFixed(2) || '0.00'}</span>
                              ) : (
                                <span>—</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Weekly Summary */}
                      <div className="border-t pt-3 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Days:</span>
                          <span className="font-bold">{item.daysWorked}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Base:</span>
                          <span className="font-medium">₱{item.totalBaseSalary.toFixed(2)}</span>
                        </div>
                        {item.totalOver > 0 && (
                          <div className="flex justify-between text-green-600 dark:text-green-400">
                            <span>Over:</span>
                            <span>+₱{item.totalOver.toFixed(2)}</span>
                          </div>
                        )}
                        {item.totalShort > 0 && (
                          <div className="flex justify-between text-red-600 dark:text-red-400">
                            <span>Short:</span>
                            <span>-₱{item.totalShort.toFixed(2)}</span>
                          </div>
                        )}
                        {item.totalDeductions > 0 && (
                          <div className="flex justify-between text-orange-600 dark:text-orange-400">
                            <span>Deduct:</span>
                            <span>-₱{item.totalDeductions.toFixed(2)}</span>
                          </div>
                        )}
                        {item.weeklyPaymentDeductions > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-purple-600 dark:text-purple-400">
                              <span>Payment Plan:</span>
                              <span>-₱{item.weeklyPaymentDeductions.toFixed(2)}</span>
                            </div>
                            {item.shortPaymentPlans && item.shortPaymentPlans.length > 0 && (
                              <div className="pl-4 space-y-0.5">
                                {item.shortPaymentPlans.map((plan, idx) => (
                                  <div key={idx} className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                                    <span>₱{plan.amount.toFixed(2)}/week</span>
                                    <span>{plan.remaining} weeks left</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {item.adjustmentsList && item.adjustmentsList.length > 0 && (
                          <div className="space-y-1">
                            <div className={`flex justify-between font-semibold ${item.totalAdjustments >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                              <span>Adjustments:</span>
                              <span>{item.totalAdjustments >= 0 ? '+' : ''}₱{item.totalAdjustments.toFixed(2)}</span>
                            </div>
                            <div className="pl-4 space-y-0.5">
                              {item.adjustmentsList.map((adj, idx) => (
                                <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                                  <div className="flex justify-between items-start">
                                    <span className="flex-1 pr-2">{adj.reason}</span>
                                    <span className={`font-semibold whitespace-nowrap ${adj.delta >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                      {adj.delta >= 0 ? '+' : ''}₱{adj.delta.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="text-[10px] opacity-60 mt-0.5">{adj.date}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Net Pay */}
                      <div className="border-t-2 mt-3 pt-3">
                        <div className="flex justify-between items-center bg-indigo-100 dark:bg-indigo-900/30 -mx-2 px-2 py-2 rounded">
                          <span className="font-bold">NET PAY:</span>
                          <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">₱{item.totalNet.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Print & Download Buttons */}
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <button
                          onClick={() => {
                            // Create enhanced print window
                            const printWindow = window.open('', '', 'width=300,height=600');
                            if (printWindow) {
                              // Get week dates
                              const now = new Date();
                              const dayOfWeek = now.getDay();
                              const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                              const weekStart = new Date(now);
                              weekStart.setDate(now.getDate() - daysFromMonday + (weekOffset * 7));
                              const weekEnd = new Date(weekStart);
                              weekEnd.setDate(weekStart.getDate() + 6);
                              
                              // Build daily breakdown
                              let dailyHTML = '';
                              for (let i = 0; i < 7; i++) {
                                const currentDay = new Date(weekStart);
                                currentDay.setDate(weekStart.getDate() + i);
                                const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i];
                                const dayPayroll = item.payrolls.find(p => {
                                  const pDate = new Date(p.createdAt || p.date);
                                  // Normalize both dates to midnight for accurate comparison
                                  const normalizedPayroll = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate());
                                  const normalizedCurrent = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
                                  return normalizedPayroll.getTime() === normalizedCurrent.getTime();
                                });
                                
                                if (dayPayroll) {
                                  dailyHTML += `<div style="display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dotted #ccc;">
                                    <span>${dayName} ${currentDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                    <span style="font-weight: bold;">₱${(dayPayroll.totalSalary || 0).toFixed(2)}</span>
                                  </div>`;
                                }
                              }
                              
                              printWindow.document.write(`
                                <html>
                                <head>
                                  <title>Weekly Payroll Receipt</title>
                                  <style>
                                    @page { size: 58mm auto; margin: 0; }
                                    body { 
                                      width: 58mm; 
                                      margin: 0; 
                                      padding: 3mm; 
                                      font-family: 'Courier New', monospace; 
                                      font-size: 8px;
                                      line-height: 1.3;
                                    }
                                    .header {
                                      text-align: center;
                                      border-bottom: 2px solid #000;
                                      padding-bottom: 3mm;
                                      margin-bottom: 3mm;
                                    }
                                    .title { font-size: 11px; font-weight: bold; margin: 0; }
                                    .subtitle { font-size: 7px; margin: 2px 0; }
                                    .section { margin: 3mm 0; padding: 2mm 0; border-bottom: 1px dashed #000; }
                                    .section-title { font-weight: bold; margin-bottom: 2mm; font-size: 9px; }
                                    .row { display: flex; justify-content: space-between; padding: 1px 0; }
                                    .daily-row { font-size: 7px; }
                                    .total-row { 
                                      font-weight: bold; 
                                      font-size: 10px; 
                                      padding: 2mm 0;
                                      border-top: 2px solid #000;
                                      border-bottom: 2px solid #000;
                                      margin-top: 2mm;
                                    }
                                    .footer { text-align: center; font-size: 7px; margin-top: 3mm; padding-top: 2mm; border-top: 1px solid #000; }
                                  </style>
                                </head>
                                <body>
                                  <div class="header">
                                    <p class="title">WEEKLY PAYROLL</p>
                                    <p class="subtitle">${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}</p>
                                  </div>
                                  
                                  <div class="section">
                                    <div class="row">
                                      <span style="font-weight: bold;">Employee:</span>
                                      <span>${item.userName}</span>
                                    </div>
                                    <div class="row">
                                      <span style="font-weight: bold;">Username:</span>
                                      <span>@${item.username}</span>
                                    </div>
                                    <div class="row">
                                      <span style="font-weight: bold;">Role:</span>
                                      <span>${item.role.toUpperCase()}</span>
                                    </div>
                                  </div>
                                  
                                  <div class="section">
                                    <div class="section-title">DAILY BREAKDOWN (${item.daysWorked} days)</div>
                                    ${dailyHTML}
                                  </div>
                                  
                                  <div class="section">
                                    <div class="section-title">WEEKLY SUMMARY</div>
                                    <div class="row">
                                      <span>Base Salary:</span>
                                      <span>₱${item.totalBaseSalary.toFixed(2)}</span>
                                    </div>
                                    ${item.totalOver > 0 ? `<div class="row"><span>Over:</span><span>+₱${item.totalOver.toFixed(2)}</span></div>` : ''}
                                    ${item.totalShort > 0 ? `<div class="row"><span>Short:</span><span>-₱${item.totalShort.toFixed(2)}</span></div>` : ''}
                                    ${item.totalDeductions > 0 ? `<div class="row"><span>Deduction:</span><span>-₱${item.totalDeductions.toFixed(2)}</span></div>` : ''}
                                    ${item.weeklyPaymentDeductions > 0 ? `<div class="row"><span>Payment Plan:</span><span>-₱${item.weeklyPaymentDeductions.toFixed(2)}</span></div>` : ''}
                                    ${item.adjustmentsList && item.adjustmentsList.length > 0 ? `<div class="row" style="font-weight: bold; color: ${item.totalAdjustments >= 0 ? '#2563eb' : '#d97706'};"><span>Adjustments:</span><span>${item.totalAdjustments >= 0 ? '+' : ''}₱${item.totalAdjustments.toFixed(2)}</span></div>` : ''}
                                    ${item.adjustmentsList && item.adjustmentsList.length > 0 ? item.adjustmentsList.map(adj => `<div class="row" style="font-size: 6px; color: #666; padding-left: 3mm;"><span style="max-width: 35mm; word-wrap: break-word;">${adj.reason}</span><span style="color: ${adj.delta >= 0 ? '#2563eb' : '#d97706'};">${adj.delta >= 0 ? '+' : ''}₱${adj.delta.toFixed(2)}</span></div>`).join('') : ''}
                                  </div>
                                  
                                  <div class="total-row">
                                    <div class="row">
                                      <span>NET PAY:</span>
                                      <span>₱${item.totalNet.toFixed(2)}</span>
                                    </div>
                                  </div>
                                  
                                  <div class="footer">
                                    <p>Generated: ${new Date().toLocaleString()}</p>
                                    <p style="margin-top: 2mm;">Thank you!</p>
                                  </div>
                                </body>
                                </html>
                              `);
                              printWindow.document.close();
                              printWindow.focus();
                              setTimeout(() => {
                                printWindow.print();
                                printWindow.close();
                              }, 250);
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 text-xs no-print"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Print
                        </button>
                        
                        <button
                          onClick={() => {
                            // Import html2canvas dynamically
                            import('html2canvas').then((html2canvas) => {
                              const receiptCard = document.getElementById(`receipt-${item.userId}`);
                              if (!receiptCard) return;
                              
                              // Clone the card and prepare for capture
                              const clone = receiptCard.cloneNode(true);
                              clone.style.width = '58mm';
                              clone.style.padding = '3mm';
                              clone.style.backgroundColor = 'white';
                              clone.style.color = 'black';
                              
                              // Remove the button from clone
                              const buttons = clone.querySelectorAll('button');
                              buttons.forEach(btn => btn.remove());
                              
                              // Create temporary container
                              const container = document.createElement('div');
                              container.style.position = 'absolute';
                              container.style.left = '-9999px';
                              container.appendChild(clone);
                              document.body.appendChild(container);
                              
                              // Convert 58mm to pixels (assuming 96 DPI)
                              const mmToPx = 3.7795275591; // 1mm = 3.78px at 96 DPI
                              const width58mm = Math.floor(58 * mmToPx); // ~219px
                              
                              html2canvas.default(clone, {
                                width: width58mm,
                                backgroundColor: '#ffffff',
                                scale: 2 // Higher quality
                              }).then((canvas) => {
                                // Convert to image and download
                                const link = document.createElement('a');
                                link.download = `weekly-payroll-${item.username}-${new Date().toISOString().split('T')[0]}.png`;
                                link.href = canvas.toDataURL('image/png');
                                link.click();
                                
                                // Cleanup
                                document.body.removeChild(container);
                              }).catch(err => {
                                console.error('Error generating image:', err);
                                document.body.removeChild(container);
                              });
                            }).catch(err => {
                              console.error('Error loading html2canvas:', err);
                              alert('Failed to load image generator. Please check your internet connection.');
                            });
                          }}
                          className="w-full px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 text-xs no-print"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download Image (58mm)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grand Total Summary */}
              <div className={`receipt-card rounded-lg ${dark ? "bg-gray-900" : "bg-gray-50"} shadow-lg p-6 border-2 ${dark ? "border-indigo-600" : "border-indigo-500"}`}>
                <div className="text-center border-b pb-3 mb-4">
                  <h4 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">WEEKLY TOTALS</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {weeklyPayrollData.length} Employee{weeklyPayrollData.length !== 1 ? 's' : ''} • {weeklyPayrollData.reduce((sum, item) => sum + item.daysWorked, 0)} Total Days
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Base Salary</p>
                    <p className="font-bold text-lg">₱{weeklyPayrollData.reduce((sum, item) => sum + item.totalBaseSalary, 0).toFixed(2)}</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs text-green-700 dark:text-green-400 mb-1">Over</p>
                    <p className="font-bold text-lg text-green-600 dark:text-green-400">₱{weeklyPayrollData.reduce((sum, item) => sum + item.totalOver, 0).toFixed(2)}</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-xs text-red-700 dark:text-red-400 mb-1">Short</p>
                    <p className="font-bold text-lg text-red-600 dark:text-red-400">₱{weeklyPayrollData.reduce((sum, item) => sum + item.totalShort, 0).toFixed(2)}</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-xs text-purple-700 dark:text-purple-400 mb-1">Payment Plan</p>
                    <p className="font-bold text-lg text-purple-600 dark:text-purple-400">₱{weeklyPayrollData.reduce((sum, item) => sum + item.weeklyPaymentDeductions, 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="bg-indigo-600 dark:bg-indigo-700 text-white p-4 rounded-lg text-center">
                  <p className="text-sm mb-1">TOTAL NET PAYROLL</p>
                  <p className="font-bold text-3xl">₱{weeklyPayrollData.reduce((sum, item) => sum + item.totalNet, 0).toFixed(2)}</p>
                </div>

                <div className="text-center mt-4 text-xs text-gray-500 dark:text-gray-400">
                  <p>Generated: {new Date().toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Daily Detail Modal */}
          {dailyDetailModal.open && dailyDetailModal.payroll && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
              <div className={`w-full max-w-md rounded-xl p-6 ${dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Daily Payroll Details</h3>
                  <button 
                    onClick={() => setDailyDetailModal({ open: false, payroll: null, userName: '', date: '' })}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Employee Info */}
                  <div className="border-b pb-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Employee</p>
                    <p className="text-lg font-bold">{dailyDetailModal.userName}</p>
                    <p className="text-sm text-indigo-600 dark:text-indigo-400">{dailyDetailModal.date}</p>
                  </div>

                  {/* Payroll Details */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Role:</span>
                      <span className="font-semibold capitalize">{dailyDetailModal.payroll.role}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Base Salary:</span>
                      <span className="font-bold">₱{(dailyDetailModal.payroll.baseSalary || 0).toFixed(2)}</span>
                    </div>

                    {dailyDetailModal.payroll.daysPresent && dailyDetailModal.payroll.daysPresent > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Days Present:</span>
                        <span className="font-semibold">{dailyDetailModal.payroll.daysPresent}</span>
                      </div>
                    )}

                    {dailyDetailModal.payroll.over > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                          <span>Over:</span>
                          <span className="font-bold">+₱{dailyDetailModal.payroll.over.toFixed(2)}</span>
                        </div>
                        {dailyDetailModal.payroll.daysPresent && dailyDetailModal.payroll.daysPresent > 0 && (
                          <div className="flex justify-between items-center text-green-500 dark:text-green-500 text-xs">
                            <span className="italic">Over Per Day:</span>
                            <span className="font-semibold">₱{(dailyDetailModal.payroll.over / dailyDetailModal.payroll.daysPresent).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {dailyDetailModal.payroll.short > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                          <span>Short:</span>
                          <span className="font-bold">-₱{dailyDetailModal.payroll.short.toFixed(2)}</span>
                        </div>
                        {dailyDetailModal.payroll.daysPresent && dailyDetailModal.payroll.daysPresent > 0 && (
                          <div className="flex justify-between items-center text-red-500 dark:text-red-500 text-xs">
                            <span className="italic">Short Per Day:</span>
                            <span className="font-semibold">₱{(dailyDetailModal.payroll.short / dailyDetailModal.payroll.daysPresent).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {dailyDetailModal.payroll.deduction > 0 && (
                      <div className="flex justify-between items-center text-orange-600 dark:text-orange-400">
                        <span>Deduction:</span>
                        <span className="font-bold">-₱{dailyDetailModal.payroll.deduction.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">Total Salary:</span>
                        <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                          ₱{(dailyDetailModal.payroll.totalSalary || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {dailyDetailModal.payroll.approved !== undefined && (
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-gray-600 dark:text-gray-400">Status:</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          dailyDetailModal.payroll.approved 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                        }`}>
                          {dailyDetailModal.payroll.approved ? "Approved" : "Pending"}
                        </span>
                      </div>
                    )}

                    {dailyDetailModal.payroll.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Notes:</p>
                        <p className="text-sm italic">{dailyDetailModal.payroll.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Close Button */}
                  <div className="pt-4">
                    <button
                      onClick={() => setDailyDetailModal({ open: false, payroll: null, userName: '', date: '' })}
                      className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {activeTab !== "weekly-summary" && (
      <div className={`rounded-lg ${dark ? "bg-gray-800" : "bg-white"} shadow p-4`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={`${dark ? "bg-gray-700" : "bg-gray-100"}`}>
              <tr>
                <th className="p-3 text-left">Employee</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-right">Base</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Over</th>
                <th className="p-3 text-right">Over/Day</th>
                <th className="p-3 text-right">Short</th>
                <th className="p-3 text-right">Deduction</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-400">Loading...</td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-400">No payroll records found.</td>
                </tr>
              ) : (
                filteredList.map((p) => {
                  const badge = statusBadge(p);
                  return (
                    <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <button 
                              onClick={() => openViewDetails(p)}
                              className="font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 text-left transition-colors cursor-pointer underline decoration-dotted"
                            >
                              {p.user?.name || p.user?.username}
                            </button>
                            <div className="text-xs opacity-70">{p.user?.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">{p.role}</td>
                      {consolidateMode !== 'none' && (
                        <td className="p-3">
                          {consolidateMode === 'weekly' ? (
                            <span className="text-xs">
                              Week of {new Date(p.period).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-xs">{p.period}</span>
                          )}
                        </td>
                      )}
                      <td className="p-3 text-right">₱{((p.baseSalary ?? p.base) || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold">₱{(p.totalSalary ?? 0).toLocaleString()}</td>
                      <td className="p-3 text-right">₱{(p.over ?? 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-green-600 dark:text-green-400 font-semibold">
                        {p.daysPresent && p.daysPresent > 0 ? `₱${((p.over ?? 0) / p.daysPresent).toFixed(2)}` : '-'}
                      </td>
                      <td className="p-3 text-right">₱{(p.short ?? 0).toLocaleString()}</td>
                      <td className="p-3 text-right">₱{((p.deduction ?? p.totalDeductions) ?? 0).toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs ${badge.color}`}>{badge.text}</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {!p.approved && !p.locked && (
                            <button title="Approve" onClick={() => handleApprove(p)} disabled={processing} className="px-2 py-1 rounded-md bg-green-600 text-white text-xs hover:opacity-90">
                              <Check className="inline-block mr-1 w-3 h-3" /> Approve
                            </button>
                          )}
                          {p.approved && !p.locked && (
                            <button title="Disapprove" onClick={() => handleDisapprove(p)} disabled={processing} className="px-2 py-1 rounded-md bg-orange-600 text-white text-xs hover:opacity-90">
                              <X className="inline-block mr-1 w-3 h-3" /> Disapprove
                            </button>
                          )}
                          {!p.locked && (
                            <button title="Adjust" onClick={() => openAdjustModal(p)} className={`px-2 py-1 rounded-md ${dark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-800"} text-xs hover:opacity-90`}>
                              <Edit3 className="inline-block mr-1 w-3 h-3" /> Adjust
                            </button>
                          )}

                          {!p.locked && (user?.role === "admin" || user?.role === "super_admin") && (
                            <button title="Override" onClick={() => openOverrideModal(p)} className="px-2 py-1 rounded-md bg-purple-600 text-white text-xs hover:opacity-90">
                              <DollarSign className="inline-block mr-1 w-3 h-3" /> Override
                            </button>
                          )}

                          <button title="View" onClick={() => openViewDetails(p)} className={`px-2 py-1 rounded-md ${dark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-800"} text-xs hover:opacity-90`}>
                            <Eye className="inline-block mr-1 w-3 h-3" /> View
                          </button>
                          <button title={p.locked ? "Unlock" : "Lock"} onClick={() => toggleLock(p)} className={`px-2 py-1 rounded-md ${p.locked ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-800"} text-xs hover:opacity-90`}>
                            {p.locked ? <Unlock className="inline-block mr-1 w-3 h-3" /> : <Lock className="inline-block mr-1 w-3 h-3" />} {p.locked ? "Unlock" : "Lock"}
                          </button>
                          {(user?.role === "admin" || user?.role === "super_admin") && (
                            <button title="Delete" onClick={() => deletePayroll(p)} className="px-2 py-1 rounded-md bg-red-600 text-white text-xs hover:bg-red-700">
                              <Trash2 className="inline-block mr-1 w-3 h-3" /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* View Totals Summary */}
        <div className={`mt-4 p-4 rounded-lg ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Daily View Totals</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <div className="text-gray-500 text-xs">Total Records</div>
              <div className="font-semibold">{viewTotals.totalRecords}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Approved</div>
              <div className="font-semibold text-green-600">{viewTotals.approvedRecords}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Pending</div>
              <div className="font-semibold text-yellow-600">{viewTotals.pendingRecords}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Total Payout (Approved)</div>
              <div className="font-semibold text-indigo-600">₱{viewTotals.totalPayout.toLocaleString()}</div>
            </div>
          </div>

          {/* Daily Breakdown */}
          {viewTotals.dailyBreakdown && viewTotals.dailyBreakdown.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-xs mb-2 text-gray-500">Breakdown by Date</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className={`${dark ? "bg-gray-800" : "bg-gray-200"}`}>
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-center">Records</th>
                      <th className="p-2 text-right">Base</th>
                      <th className="p-2 text-right">Over</th>
                      <th className="p-2 text-right">Short</th>
                      <th className="p-2 text-right">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewTotals.dailyBreakdown.map((day, idx) => (
                      <tr key={idx} className={`${dark ? "hover:bg-gray-800" : "hover:bg-gray-50"}`}>
                        <td className="p-2 font-medium">{day.date}</td>
                        <td className="p-2 text-center">
                          <span className="text-green-600">{day.approved}</span>
                          {day.pending > 0 && <span className="text-yellow-600"> / {day.pending}</span>}
                        </td>
                        <td className="p-2 text-right">₱{day.base.toLocaleString()}</td>
                        <td className="p-2 text-right text-green-600">₱{day.over.toLocaleString()}</td>
                        <td className="p-2 text-right text-red-600">₱{day.short.toLocaleString()}</td>
                        <td className="p-2 text-right font-semibold text-indigo-600">₱{day.totalPayout.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Adjust Modal */}
      {adjustModal.open && adjustModal.payroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className={`w-full max-w-lg rounded-xl p-6 ${dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Adjust Payroll</h3>
              <button onClick={() => setAdjustModal({ open: false, payroll: null })} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><X /></button>
            </div>

            <div className="mb-3">
              <div className="text-sm text-gray-400">Employee</div>
              <div className="font-semibold">{adjustModal.payroll.user?.name || adjustModal.payroll.user?.username}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-sm text-gray-400">Type</div>
                <div className="mt-2 flex gap-2">
                  <label className={`py-2 px-3 rounded-lg cursor-pointer ${adjustKind === "add" ? "bg-indigo-600 text-white" : dark ? "bg-gray-700 text-gray-100" : "bg-gray-100 text-gray-800"}`}>
                    <input type="radio" className="hidden" checked={adjustKind === "add"} onChange={() => setAdjustKind("add")} />
                    Add
                  </label>
                  <label className={`py-2 px-3 rounded-lg cursor-pointer ${adjustKind === "deduct" ? "bg-red-600 text-white" : dark ? "bg-gray-700 text-gray-100" : "bg-gray-100 text-gray-800"}`}>
                    <input type="radio" className="hidden" checked={adjustKind === "deduct"} onChange={() => setAdjustKind("deduct")} />
                    Deduct
                  </label>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Amount</div>
                <input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} className={`mt-2 w-full p-2 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`} placeholder="Enter amount" />
              </div>
            </div>

            <div className="mb-3">
              <div className="text-sm text-gray-400">Reason</div>
              <textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className={`mt-2 w-full p-2 rounded-lg border resize-none ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`} rows={3} placeholder="Enter reason (required for audit)..." />
            </div>

            {/* Payment Terms - Show only if payroll has short amount */}
            {adjustModal.payroll.short > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                <div className="text-sm text-gray-400 mb-2">
                  💳 Payment Terms for Short (₱{adjustModal.payroll.short.toLocaleString()})
                </div>
                <input
                  type="number"
                  min="1"
                  value={adjustPaymentTerms}
                  onChange={(e) => setAdjustPaymentTerms(e.target.value)}
                  className={`w-full p-2 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-white border-gray-300"}`}
                  placeholder="Number of weeks"
                />
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {adjustPaymentTerms > 1 ? (
                    <span className="text-orange-600 dark:text-orange-400 font-semibold">
                      ₱{(adjustModal.payroll.short / parseInt(adjustPaymentTerms)).toFixed(2)}/week for {adjustPaymentTerms} weeks
                    </span>
                  ) : (
                    "Deduct the full short amount this week"
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setAdjustModal({ open: false, payroll: null })} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700">Cancel</button>
              <button onClick={handleAdjustProceed} className="px-4 py-2 rounded-lg bg-indigo-600 text-white">Proceed</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Override Modal - Super Admin Only */}
      {createOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className={`w-full max-w-2xl rounded-xl p-6 max-h-[90vh] overflow-y-auto ${dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="text-purple-500" />
                Create Payroll Override
              </h3>
              <button onClick={() => setCreateOverrideModal(false)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><X /></button>
            </div>

            <div className="mb-4 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="text-sm text-purple-700 dark:text-purple-300">
                Create a new payroll entry for a user with custom base salary, over/short amounts, and reason.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-gray-400 mb-2">Select User *</div>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className={`w-full p-3 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`}
                >
                  <option value="">-- Select User --</option>
                  {usersList.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.name || u.username} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">Select Date Range *</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className={`w-full p-2 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className={`w-full p-2 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`}
                  />
                </div>
              </div>
              
              {selectedDates.length > 0 && (
                <div className={`p-3 rounded-lg border max-h-40 overflow-y-auto ${dark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"}`}>
                  <div className="text-xs text-gray-500 mb-2">Selected Dates ({selectedDates.length}):</div>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedDates.map(date => (
                      <label key={date} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => toggleDate(date)}
                          className="rounded"
                        />
                        <span>{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-sm text-gray-400 mb-2">Base Salary *</div>
                <input
                  type="number"
                  step="0.01"
                  value={createBaseSalary}
                  onChange={(e) => setCreateBaseSalary(e.target.value)}
                  placeholder="450.00"
                  className={`w-full p-3 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`}
                />
              </div>

              <div>
                <div className="text-sm text-gray-400 mb-2">Over Amount</div>
                <input
                  type="number"
                  step="0.01"
                  value={createOver}
                  onChange={(e) => setCreateOver(e.target.value)}
                  placeholder="0.00"
                  className={`w-full p-3 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`}
                />
              </div>

              <div>
                <div className="text-sm text-gray-400 mb-2">Short Amount</div>
                <input
                  type="number"
                  step="0.01"
                  value={createShort}
                  onChange={(e) => setCreateShort(e.target.value)}
                  placeholder="0.00"
                  className={`w-full p-3 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`}
                />
              </div>

              <div>
                <div className="text-sm text-gray-400 mb-2">Payment Terms (Weeks)</div>
                <input
                  type="number"
                  min="1"
                  value={createShortPaymentTerms}
                  onChange={(e) => setCreateShortPaymentTerms(e.target.value)}
                  placeholder="1"
                  className={`w-full p-3 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`}
                />
                <div className="text-xs text-gray-400 mt-1">
                  {createShort && createShortPaymentTerms > 1 ? (
                    <span className="text-orange-500">₱{(parseFloat(createShort) / parseInt(createShortPaymentTerms)).toFixed(2)}/week for {createShortPaymentTerms} weeks</span>
                  ) : (
                    "Number of weeks to deduct the short amount"
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">Reason *</div>
              <textarea
                value={createReason}
                onChange={(e) => setCreateReason(e.target.value)}
                className={`w-full p-3 rounded-lg border resize-none ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`}
                rows={3}
                placeholder="Explain why this payroll override is being created (e.g., Manual correction, Missed day entry, etc.)"
              />
            </div>

            {selectedUserId && createBaseSalary && selectedDates.length > 0 && (
              <div className={`mb-4 p-3 rounded-lg ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                <div className="text-sm font-semibold mb-2">Preview (Per Day)</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Base Salary:</div>
                  <div className="font-semibold">₱{parseFloat(createBaseSalary || 0).toFixed(2)}</div>
                  <div>Over:</div>
                  <div className="text-green-600 font-semibold">+₱{parseFloat(createOver || 0).toFixed(2)}</div>
                  <div>Short:</div>
                  <div className="text-red-600 font-semibold">-₱{parseFloat(createShort || 0).toFixed(2)}</div>
                  <div className="border-t pt-2 font-bold">Total Per Day:</div>
                  <div className="border-t pt-2 font-bold text-indigo-600">
                    ₱{(parseFloat(createBaseSalary || 0) + parseFloat(createOver || 0) - parseFloat(createShort || 0)).toFixed(2)}
                  </div>
                  <div className="border-t pt-2 font-bold text-purple-600">Number of Days:</div>
                  <div className="border-t pt-2 font-bold text-purple-600">{selectedDates.length} days</div>
                  <div className="border-t pt-2 font-bold text-lg">Grand Total:</div>
                  <div className="border-t pt-2 font-bold text-lg text-green-600">
                    ₱{((parseFloat(createBaseSalary || 0) + parseFloat(createOver || 0) - parseFloat(createShort || 0)) * selectedDates.length).toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCreateOverrideModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOverride}
                disabled={processing}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {processing ? "Creating..." : "Create Override"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override Modal - Super Admin Only */}
      {overrideModal.open && overrideModal.payroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className={`w-full max-w-lg rounded-xl p-6 ${dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="text-purple-500" />
                Payroll Override (Super Admin)
              </h3>
              <button onClick={() => setOverrideModal({ open: false, payroll: null })} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><X /></button>
            </div>

            <div className="mb-4 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="text-sm text-purple-700 dark:text-purple-300">
                Override allows you to add or deduct any amount from the payroll with a specific reason. This will be visible to all users viewing payroll.
              </div>
            </div>

            <div className="mb-3">
              <div className="text-sm text-gray-400">Employee</div>
              <div className="font-semibold">{overrideModal.payroll.user?.name || overrideModal.payroll.user?.username}</div>
              <div className="text-xs opacity-70">Current Total: ₱{(overrideModal.payroll.totalSalary ?? 0).toLocaleString()}</div>
            </div>

            <div className="mb-3">
              <div className="text-sm text-gray-400 mb-2">Base Salary</div>
              <input 
                type="number" 
                step="0.01"
                value={overrideBaseSalary} 
                onChange={(e) => setOverrideBaseSalary(e.target.value)} 
                className={`w-full p-3 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`} 
                placeholder="Enter base salary" 
              />
              <div className="text-xs text-gray-400 mt-1">Adjust the base salary if needed</div>
            </div>

            <div className="mb-3">
              <div className="text-sm text-gray-400 mb-2">Override Date</div>
              <input 
                type="date" 
                value={overrideDate} 
                onChange={(e) => setOverrideDate(e.target.value)} 
                className={`w-full p-3 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`}
              />
              <div className="text-xs text-gray-400 mt-1">Specify which date this override applies to</div>
            </div>

            <div className="mb-3">
              <div className="text-sm text-gray-400 mb-2">Override Amount</div>
              <input 
                type="number" 
                step="0.01"
                value={overrideAmount} 
                onChange={(e) => setOverrideAmount(e.target.value)} 
                className={`w-full p-3 rounded-lg border ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`} 
                placeholder="Enter amount (e.g., 500 or -200)" 
              />
              <div className="text-xs text-gray-400 mt-1">Use positive numbers to add, negative to deduct</div>
            </div>

            <div className="mb-3">
              <div className="text-sm text-gray-400 mb-2">Reason (Required)</div>
              <textarea 
                value={overrideReason} 
                onChange={(e) => setOverrideReason(e.target.value)} 
                className={`w-full p-3 rounded-lg border resize-none ${dark ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-gray-50 border-gray-200"}`} 
                rows={3} 
                placeholder="Explain why this override is necessary (e.g., Bonus for exceptional performance, Correction for reporting error, etc.)" 
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setOverrideModal({ open: false, payroll: null })} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700">Cancel</button>
              <button 
                onClick={handleOverride} 
                disabled={processing}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {processing ? "Processing..." : "Apply Override"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Adjust Modal */}
      {confirmAdjust.open && confirmAdjust.payroll && confirmAdjust.payload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className={`w-full max-w-md rounded-xl p-6 ${dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"}`}>
            <h3 className="text-lg font-semibold mb-2">Confirm Adjustment</h3>
            <div className="text-sm mb-4">
              {confirmAdjust.payload.delta !== 0 && (
                <p className="mb-2">
                  Are you sure you want to <strong>{confirmAdjust.payload.delta > 0 ? "add" : "deduct"}</strong>{" "}
                  <strong>₱{Math.abs(confirmAdjust.payload.delta).toFixed(2)}</strong> for{" "}
                  <strong>{confirmAdjust.payroll.user?.name || confirmAdjust.payroll.user?.username}</strong>?
                </p>
              )}
              {confirmAdjust.payroll.short > 0 && adjustPaymentTerms && (
                <p className="p-2 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                  <strong>Payment Terms:</strong> Short of ₱{confirmAdjust.payroll.short.toLocaleString()} will be deducted over{" "}
                  <strong>{adjustPaymentTerms} week{adjustPaymentTerms > 1 ? 's' : ''}</strong>
                  {adjustPaymentTerms > 1 && ` (₱${(confirmAdjust.payroll.short / parseInt(adjustPaymentTerms)).toFixed(2)}/week)`}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAdjust({ open: false, payroll: null, payload: null })} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700">Cancel</button>
              <button onClick={confirmAdjustFinal} disabled={processing} className="px-4 py-2 rounded-lg bg-green-600 text-white">
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 overflow-y-auto">
          <div className={`w-full max-w-3xl rounded-xl p-6 my-8 ${dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Payroll Details</h3>
              <button onClick={() => setViewPayroll(null)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><X /></button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-gray-400">Employee</div>
                <div className="font-semibold">{viewPayroll.user?.name || viewPayroll.user?.username}</div>
                <div className="text-xs opacity-70">{viewPayroll.user?.username}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Role</div>
                <div className="font-semibold">{viewPayroll.role}</div>
                <div className="text-sm text-gray-400">Date</div>
                <div>{new Date(viewPayroll.createdAt || viewPayroll.date).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-gray-400">Base Salary</div>
                <div className="font-semibold">₱{(viewPayroll.baseSalary ?? 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Total Salary</div>
                <div className="font-semibold">₱{(viewPayroll.totalSalary ?? 0).toLocaleString()}</div>
              </div>
              {viewPayroll.daysPresent && viewPayroll.daysPresent > 0 && (
                <div>
                  <div className="text-sm text-gray-400">Days Present</div>
                  <div className="font-semibold">{viewPayroll.daysPresent} day{viewPayroll.daysPresent !== 1 ? 's' : ''}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-400">Over</div>
                <div>₱{(viewPayroll.over ?? 0).toLocaleString()}</div>
              </div>
              {viewPayroll.over > 0 && viewPayroll.daysPresent && viewPayroll.daysPresent > 0 && (
                <div>
                  <div className="text-sm text-gray-400">Over Per Day</div>
                  <div className="text-green-600 dark:text-green-400 font-semibold">
                    ₱{((viewPayroll.over ?? 0) / viewPayroll.daysPresent).toFixed(2)}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-400">Short</div>
                <div>₱{(viewPayroll.short ?? 0).toLocaleString()}</div>
              </div>
              {viewPayroll.short > 0 && (
                <div>
                  <div className="text-sm text-gray-400">Payment Terms</div>
                  <div>
                    {viewPayroll.shortPaymentTerms && viewPayroll.shortPaymentTerms > 1 ? (
                      <span className="text-orange-500 font-semibold">
                        {viewPayroll.shortPaymentTerms} weeks
                        <span className="text-xs ml-1">(₱{(viewPayroll.short / viewPayroll.shortPaymentTerms).toFixed(2)}/week)</span>
                      </span>
                    ) : (
                      <span className="text-gray-500">1 week (full payment)</span>
                    )}
                  </div>
                </div>
              )}
              <div className={viewPayroll.short > 0 ? "" : "col-span-2"}>
                <div className="text-sm text-gray-400">Deductions</div>
                <div>₱{(viewPayroll.deduction ?? viewPayroll.totalDeductions ?? 0).toLocaleString()}</div>
              </div>
            </div>
            
            {/* Payment Terms Note */}
            {viewPayroll.note && (
              <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="text-sm text-gray-400 mb-1">Payment Terms</div>
                <div className="text-sm">{viewPayroll.note}</div>
              </div>
            )}

            {/* Daily Reports - Only for Tellers */}
            {viewPayroll.role === "teller" && dailyReports.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Daily Reports This Month
                </h4>
                <div className={`rounded-lg overflow-hidden ${dark ? "bg-gray-700" : "bg-gray-50"}`}>
                  <table className="w-full text-sm">
                    <thead className={`${dark ? "bg-gray-600" : "bg-gray-200"}`}>
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
                        const hasData = (report.over > 0 || report.short > 0 || report.systemBalance > 0);
                        const paymentTerms = Number(report.shortPaymentTerms) || 1;
                        const weeklyDeduction = report.short > 0 && paymentTerms > 1 ? (report.short / paymentTerms) : null;
                        
                        // Only show reports that have data
                        if (!hasData) return null;
                        
                        return (
                          <tr key={idx} className={`border-t ${dark ? "border-gray-600" : "border-gray-200"}`}>
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

            <div>
              <h4 className="font-semibold mb-2">Adjustments & Overrides</h4>
              {viewPayroll.adjustments?.length ? (
                <ul className="space-y-2">
                  {viewPayroll.adjustments.map((a, idx) => {
                    const isOverride = a.reason?.startsWith('[OVERRIDE]');
                    const displayReason = isOverride ? a.reason.replace('[OVERRIDE]', '').trim() : (a.reason || "Manual adjustment");
                    return (
                      <li key={idx} className={`text-sm p-3 rounded-lg ${isOverride ? (dark ? 'bg-purple-900/20 border border-purple-800' : 'bg-purple-50 border border-purple-200') : (dark ? 'bg-gray-700' : 'bg-gray-50')}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {isOverride && (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-600 text-white">OVERRIDE</span>
                              )}
                              <div className="text-xs opacity-70">{new Date(a.createdAt).toLocaleString()}</div>
                            </div>
                            <div className={isOverride ? 'font-medium' : ''}>{displayReason}</div>
                          </div>
                          <div className={`font-bold text-lg ml-3 ${a.delta >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {a.delta >= 0 ? "+" : "-"}₱{Math.abs(a.delta).toFixed(2)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-sm opacity-70">No adjustments or overrides</div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => setViewPayroll(null)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
