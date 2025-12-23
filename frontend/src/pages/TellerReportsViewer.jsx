import React, { useEffect, useState, useContext, useMemo } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { List, FileText, Check, Lock, Unlock, Trash2, Calendar, Filter, Search } from "lucide-react";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";
import EditReportForm from "./EditReportForm.jsx";

export default function TellerReportsViewer() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [tellers, setTellers] = useState([]); // left list of teller summaries
  const [selected, setSelected] = useState(null); // selected teller's report details
  const [loading, setLoading] = useState(false);
  const [fetchingList, setFetchingList] = useState(false);
  const [editing, setEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // Search filter

  // Date filter state
  const [dateFilter, setDateFilter] = useState({
    date: "",
    enabled: false
  });
  
  // Short/Over filter state
  const [shortOverFilter, setShortOverFilter] = useState("all"); // 'all' | 'short' | 'over'
  
  // Payment terms input state for real-time calculation
  const [paymentTermsInput, setPaymentTermsInput] = useState(1);

  // Compute aggregated totals across the currently listed tellers
  const aggregatedTotals = useMemo(() => {
    let totalSystemBalance = 0;
    let totalCashOnHand = 0;
    for (const t of tellers) {
      totalSystemBalance += Number(t.systemBalance || 0);
      totalCashOnHand += Number(t.cashOnHand || t.totalFromDenom || 0);
    }
    const diff = totalCashOnHand - totalSystemBalance;
    const totalOver = diff > 0 ? diff : 0;
    const totalShort = diff < 0 ? Math.abs(diff) : 0;
    return {
      totalSystemBalance,
      totalCashOnHand,
      totalOver,
      totalShort,
    };
  }, [tellers]);

  // Filter tellers by search query and short/over
  const filteredTellers = useMemo(() => {
    let filtered = tellers;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => {
        const name = (t.tellerName || "").toLowerCase();
        return name.includes(query);
      });
    }
    
    // Apply short/over filter
    if (shortOverFilter === 'short') {
      filtered = filtered.filter(t => {
        const short = Number(t.short || 0);
        return short > 0;
      });
    } else if (shortOverFilter === 'over') {
      filtered = filtered.filter(t => {
        const over = Number(t.over || 0);
        return over > 0;
      });
    }
    
    return filtered;
  }, [tellers, searchQuery, shortOverFilter]);

  // normalize helper: ensure pieces & totals are present
  const normalizeReport = (r) => {
    if (!r) return null;
    const out = { ...r };

    // Ensure we consistently carry tellerId as userId for downstream handlers
    out.userId = r.userId || r.tellerId || out.userId;
    out._id = r._id || out._id;

    // Normalize status flag naming differences (backend uses isApproved/isVerified)
    out.verified = r.verified ?? r.isVerified ?? false;
    out.approved = r.approved ?? r.isApproved ?? false;

    // Add tellerName fallback
    out.tellerName = r.tellerName || r.tellerId?.name || r.tellerId?.username || out.tellerName;

    out.pcs1000 = Number(r.pcs1000 ?? r.pcs_1000 ?? r.d1000 ?? r.pcs1000 ?? 0);
    out.pcs500 = Number(r.pcs500 ?? r.pcs_500 ?? r.d500 ?? 0);
    out.pcs200 = Number(r.pcs200 ?? r.pcs_200 ?? r.d200 ?? 0);
    out.pcs100 = Number(r.pcs100 ?? r.pcs_100 ?? r.d100 ?? 0);
    out.pcs50 = Number(r.pcs50 ?? r.pcs_50 ?? r.d50 ?? 0);
    out.pcs20 = Number(r.pcs20 ?? r.pcs_20 ?? r.d20 ?? 0);
    out.coins = Number(r.coins ?? r.pcsCoins ?? 0);

    out.shortPaymentTerms = Number(r.shortPaymentTerms ?? 1);

    out.d1000 = out.pcs1000;
    out.d500 = out.pcs500;
    out.d200 = out.pcs200;
    out.d100 = out.pcs100;
    out.d50 = out.pcs50;
    out.d20 = out.pcs20;

    out.totalFromDenom =
      Number(r.totalFromDenom ?? r.totalDenomination ?? 0) ||
      out.pcs1000 * 1000 +
        out.pcs500 * 500 +
        out.pcs200 * 200 +
        out.pcs100 * 100 +
        out.pcs50 * 50 +
        out.pcs20 * 20 +
        out.coins;

    out.cashOnHand = Number(r.cashOnHand ?? r.cash_on_hand ?? r.totalFromDenom ?? out.totalFromDenom);

    const sys = Number(r.systemBalance ?? r.system_balance ?? 0);
    if (r.short == null && r.over == null) {
      // Only recalculate if short/over are completely missing (null/undefined)
      if (sys > 0) {
        if (out.cashOnHand > sys) {
          out.over = (out.cashOnHand - sys).toFixed(2);
          out.short = "";
        } else if (out.cashOnHand < sys) {
          out.short = (sys - out.cashOnHand).toFixed(2);
          out.over = "";
        } else {
          out.short = "";
          out.over = "";
        }
      } else {
        out.short = out.short ?? "";
        out.over = out.over ?? "";
      }
    } else {
      // Use the stored values (including 0)
      out.short = Number(r.short ?? 0);
      out.over = Number(r.over ?? 0);
    }

    return out;
  };

  // Consistent datetime formatting (Asia/Manila). Accepts string/Date, returns readable local string.
  const formatDateTime = (value) => {
    if (!value) return "-";
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return "-";
    }
  };

  // list fetching: for admin -> /api/teller-reports/all, for supervisor -> /api/teller-reports/by-supervisor/:id
  const fetchList = async () => {
    try {
      setFetchingList(true);
      
      // Build query parameters for date filtering
      const params = new URLSearchParams();
      if (dateFilter.enabled && dateFilter.date) {
        params.append('date', dateFilter.date);
      }
      
      const queryString = params.toString();
      const urlSuffix = queryString ? `?${queryString}` : '';
      
      if (user?.role === "admin" || user?.role === "super_admin") {
        const res = await axios.get(`${getApiUrl()}/api/teller-reports/all${urlSuffix}`);
        // backend returns { reports: [...] }
        const list = Array.isArray(res.data) ? res.data : res.data?.reports || [];
        // Keep ALL reports, don't dedupe - show all historical reports
        const normalized = list.map(raw => {
          const tellerId = raw.tellerId?._id || raw.tellerId || raw.userId;
          return normalizeReport({ ...raw, userId: tellerId });
        }).filter(r => r.userId); // Only keep reports with valid userId
        setTellers(normalized);
      } else if (user?.role === "supervisor") {
        // backend route is /supervisor/:supervisorId and returns { tellers: [...] }
        const res = await axios.get(`${getApiUrl()}/api/teller-reports/supervisor/${user._id}${urlSuffix}`);
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.tellers || res.data?.reports || [];
        // Keep ALL reports, don't dedupe
        const normalized = list.map(raw => {
          const tellerId = raw.tellerId?._id || raw.tellerId || raw.userId;
          return normalizeReport({ ...raw, userId: tellerId });
        }).filter(r => r.userId);
        setTellers(normalized);
      } else {
        // tellers can't view list of others
        setTellers([]);
      }
    } catch (err) {
      console.error("Failed to fetch teller list:", err?.response?.data || err.message, err);
      showToast({ type: "error", message: "Failed to load tellers" });
    } finally {
      setFetchingList(false);
    }
  };

  useEffect(() => {
    fetchList();

    const onUpdate = () => {
      fetchList();
      if (selected?._id) fetchDetails(selected._id);
    };

    const socket = getGlobalSocket();
    if (socket) {
      socket.on("reportUpdated", onUpdate);
      socket.on("tellerReportCreated", onUpdate);
      socket.on("tellerManagementUpdated", onUpdate);
      socket.on("reportDeleted", onUpdate);

      return () => {
        socket.off("reportUpdated", onUpdate);
        socket.off("tellerReportCreated", onUpdate);
        socket.off("tellerManagementUpdated", onUpdate);
        socket.off("reportDeleted", onUpdate);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // fetch details for a single report by its _id
  const fetchDetails = async (reportId) => {
    try {
      setLoading(true);
      
      // Find the report in the tellers list by _id
      const report = tellers.find(t => t._id === reportId);
      if (report) {
        const normalized = normalizeReport(report);
        setSelected(normalized);
        setPaymentTermsInput(Number(normalized.shortPaymentTerms) || 1);
      } else {
        // Fallback: fetch from server if not in list
        const res = await axios.get(`${getApiUrl()}/api/teller-reports/report/${reportId}`);
        const normalized = res.data ? normalizeReport(res.data) : null;
        setSelected(normalized);
        setPaymentTermsInput(Number(normalized?.shortPaymentTerms) || 1);
      }
    } catch (err) {
      console.error("Failed to fetch details:", err?.response?.data || err.message);
      showToast({ type: "error", message: "Failed to load details" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (reportId) => {
    try {
      if (!selected?._id) return showToast({ type: "error", message: "No report selected" });
      await axios.put(`${getApiUrl()}/api/teller-reports/report/${selected._id}/verify`);
      showToast({ type: "success", message: "Report verified" });
      
      // Update selected report with new status
      setSelected(prev => ({ ...prev, verified: true, isVerified: true, isPending: false }));
      
      // Refresh the list to reflect changes
      fetchList();
    } catch (err) {
      console.error("Verify failed:", err?.response?.data || err.message);
      showToast({ type: "error", message: "Failed to verify" });
    }
  };

  const handleApprove = async (reportId) => {
    try {
      if (!selected?._id) return showToast({ type: "error", message: "No report selected" });
      await axios.put(`${getApiUrl()}/api/teller-reports/report/${selected._id}/approve`);
      showToast({ type: "success", message: "Report approved" });
      
      // Update selected report with new status
      setSelected(prev => ({ ...prev, approved: true, isApproved: true, isPending: false }));
      
      // Refresh the list to reflect changes
      fetchList();
    } catch (err) {
      console.error("Approve failed:", err?.response?.data || err.message);
      showToast({ type: "error", message: "Failed to approve" });
    }
  };

  const handleUnlock = async (reportId) => {
    try {
      if (!selected?._id) return showToast({ type: "error", message: "No report selected" });
      await axios.put(`${getApiUrl()}/api/teller-reports/report/${selected._id}/unlock`);
      showToast({ type: "success", message: "Report unlocked" });
      fetchList();
      fetchDetails(selected._id);
    } catch (err) {
      console.error("Unlock failed:", err?.response?.data || err.message);
      showToast({ type: "error", message: "Failed to unlock" });
    }
  };

  const handleDeleteSelected = async () => {
    if (!selected?._id) {
      showToast({ type: "error", message: "No report selected" });
      return;
    }
    const ok = window.confirm("Delete this report? This cannot be undone.");
    if (!ok) return;
    try {
      await axios.delete(`${getApiUrl()}/api/teller-reports/${selected._id}`, {
        data: { adminId: user?._id, reason: "Admin delete from Reports Viewer" },
      });
      showToast({ type: "info", message: "Report deleted" });
      const tellerId = selected.userId;
      setSelected(null);
      fetchList();
      if (tellerId) fetchDetails(tellerId);
    } catch (err) {
      console.error("Delete failed:", err?.response?.data || err.message);
      showToast({ type: "error", message: "Failed to delete report" });
    }
  };

  // Admin can set totalBet (endpoint from earlier)
  const handleUpdateTotalBet = async (tellerId, value) => {
    try {
      await axios.put(`${getApiUrl()}/api/reports/supervisor/update-bet/${tellerId}`, { totalBet: Number(value || 0) });
      showToast({ type: "success", message: "Total Bet updated" });
      fetchList();
      fetchDetails(tellerId);
    } catch (err) {
      console.error("Update total bet failed:", err?.response?.data || err.message);
      showToast({ type: "error", message: "Failed to update Total Bet" });
    }
  };

  const handleUpdateShortPaymentTerms = async (reportId, terms) => {
    try {
      const numTerms = Number(terms || 1);
      if (numTerms < 1) {
        showToast({ type: "warning", message: "Payment terms must be at least 1" });
        setPaymentTermsInput(selected?.shortPaymentTerms || 1); // Reset to saved value
        return;
      }
      
      // Don't update if value hasn't changed
      if (numTerms === (selected?.shortPaymentTerms || 1)) {
        return;
      }
      
      await axios.put(`${getApiUrl()}/api/reports/teller/${reportId}`, { shortPaymentTerms: numTerms });
      showToast({ type: "success", message: `Payment terms set to ${numTerms} weeks` });
      
      // Update selected report with new value to prevent re-fetch from resetting
      if (selected) {
        setSelected({ ...selected, shortPaymentTerms: numTerms });
      }
      
      // Refresh list only (not details to avoid input reset)
      fetchList();
    } catch (err) {
      console.error("Update payment terms failed:", err?.response?.data || err.message);
      showToast({ type: "error", message: "Failed to update payment terms" });
      // Revert state on error
      if (selected?.shortPaymentTerms) {
        setPaymentTermsInput(Number(selected.shortPaymentTerms) || 1);
      }
    }
  };

  const handleApproveAll = async () => {
    if (!window.confirm("Approve all currently listed reports?")) return;
    try {
      for (const t of tellers) {
        if (!t.userId) continue;
        const res = await axios.get(`${getApiUrl()}/api/teller-reports/teller/${t.userId}`);
        const latest = res.data?.reports?.[0];
        if (latest?._id) {
          await axios.put(`${getApiUrl()}/api/teller-reports/report/${latest._id}/approve`);
        }
      }
      showToast({ type: "success", message: "All reports approved" });
      fetchList();
    } catch (err) {
      console.error("Approve all failed:", err?.response?.data || err.message);
      showToast({ type: "error", message: "Failed to approve all" });
    }
  };

  return (
    <div className={`flex gap-6 p-6 min-h-screen ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      {/* Left: Teller list with date filter */}
      <div className="w-80 bg-white dark:bg-gray-800 border rounded p-3 overflow-y-auto">
        {/* Date Filter Section */}
        <div className={`p-3 rounded mb-3 ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4" />
            <span className="font-medium text-sm">Date Filter</span>
            <label className="ml-auto flex items-center gap-2">
              <input
                type="checkbox"
                checked={dateFilter.enabled}
                onChange={(e) => setDateFilter(prev => ({ ...prev, enabled: e.target.checked }))}
                className="rounded"
              />
              <span className="text-xs">Enable</span>
            </label>
          </div>
          
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date:</label>
              <input
                type="date"
                value={dateFilter.date}
                onChange={(e) => setDateFilter(prev => ({ ...prev, date: e.target.value }))}
                disabled={!dateFilter.enabled}
                className={`w-full text-xs p-2 border rounded ${
                  dark ? "bg-gray-800 border-gray-600" : "bg-white border-gray-300"
                } ${!dateFilter.enabled ? "opacity-50" : ""}`}
              />
            </div>
            <button
              onClick={() => fetchList()}
              disabled={!dateFilter.enabled}
              className={`w-full text-xs px-3 py-2 rounded flex items-center justify-center gap-2 ${
                dateFilter.enabled 
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                  : "bg-gray-400 text-gray-200 cursor-not-allowed"
              }`}
            >
              <Filter className="w-3 h-3" />
              Apply Filter
            </button>
          </div>
        </div>
        
        {/* Search bar */}
        <div className="mb-3">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${dark ? "text-gray-400" : "text-gray-500"}`} />
            <input
              type="text"
              placeholder="Search by teller name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full text-sm pl-10 pr-4 py-2 border rounded ${
                dark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300"
              }`}
            />
          </div>
        </div>
        
        {/* Short/Over Filter */}
        <div className="mb-3">
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Filter by:</label>
          <select
            value={shortOverFilter}
            onChange={(e) => setShortOverFilter(e.target.value)}
            className={`w-full text-sm p-2 border rounded ${
              dark ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300"
            }`}
          >
            <option value="all">All Reports</option>
            <option value="short">Short Only</option>
            <option value="over">Over Only</option>
          </select>
        </div>
        
        {/* Aggregated totals (system balance / cash on hand -> over/short) */}
        <div className={`p-3 rounded mb-3 ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
          <div className="text-xs font-medium mb-2">Aggregated Totals</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>System Balance:</div>
            <div className="text-right">₱{Number(aggregatedTotals.totalSystemBalance || 0).toLocaleString()}</div>
            <div>Cash On Hand:</div>
            <div className="text-right">₱{Number(aggregatedTotals.totalCashOnHand || 0).toLocaleString()}</div>
            <div>Over:</div>
            <div className="text-right text-green-600">₱{Number(aggregatedTotals.totalOver || 0).toLocaleString()}</div>
            <div>Short:</div>
            <div className="text-right text-red-600">₱{Number(aggregatedTotals.totalShort || 0).toLocaleString()}</div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><List /> Tellers</h3>
          {(user?.role === "admin" || user?.role === "super_admin") && (
            <button onClick={handleApproveAll} className="text-xs bg-green-600 px-2 py-1 rounded text-white">Approve All</button>
          )}
        </div>

        {fetchingList ? (
          <div className="py-6 text-center">Loading...</div>
        ) : (
          <div className="space-y-2">
            {filteredTellers.length === 0 ? (
              <div className="text-sm text-gray-500">
                {searchQuery ? "No tellers match your search." : "No teller reports found."}
              </div>
            ) : (
              filteredTellers.map((t) => {
                const keyId = t._id ? `${t.userId}-${t._id}` : `${t.userId}`;
                return (
                  <div
                    key={keyId}
                    onClick={() => fetchDetails(t._id)}
                    className={`p-3 rounded cursor-pointer border ${selected?._id === t._id ? "bg-indigo-600 text-white" : dark ? "bg-gray-800" : "bg-white"} `}
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-medium">{t.tellerName || t.tellerName}</div>
                      <div className="text-sm">{t.verified ? <span className="text-green-300">Verified</span> : t.approved ? <span className="text-indigo-300">Approved</span> : <span className="text-yellow-400">Pending</span>}</div>
                    </div>
                    <div className="text-xs opacity-80 mt-1">Cash: ₱{Number(t.cashOnHand || t.totalFromDenom || 0).toLocaleString()}</div>
                    <div className="text-xs opacity-60 mt-1">
                      {new Date(t.createdAt || t.date).toLocaleDateString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Right: Details */}
      <div className="flex-1">
        <div className={`rounded p-4 border ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2"><FileText /> Teller Report</h2>
              <div className="text-sm text-gray-400">Select a teller on the left to view details</div>
            </div>

            <div className="flex gap-2">
              {selected && (
                <>
                  {user?.role === "supervisor" && !selected.verified && (
                    <button onClick={() => handleVerify(selected._id)} className="bg-green-600 px-3 py-1 rounded text-white flex items-center gap-2"><Check /> Verify</button>
                  )}

                  {(user?.role === "admin" || user?.role === "super_admin") && (
                    <>
                      <button onClick={() => setEditing(true)} className="bg-blue-600 px-3 py-1 rounded text-white flex items-center gap-2">Edit</button>
                      <button onClick={() => handleApprove(selected._id)} className="bg-indigo-600 px-3 py-1 rounded text-white flex items-center gap-2">Approve</button>
                      <button onClick={() => handleUnlock(selected._id)} className="bg-yellow-500 px-3 py-1 rounded text-white flex items-center gap-2"><Unlock /> Unlock</button>
                      <button onClick={handleDeleteSelected} className="bg-red-700 px-3 py-1 rounded text-white flex items-center gap-2"><Trash2 /> Delete</button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div>Loading details...</div>
          ) : !selected ? (
            <div className="text-sm text-gray-400">Pick a teller to view their latest report.</div>
          ) : editing ? (
            <EditReportForm selected={selected} onCancel={() => setEditing(false)} onSave={async (fields) => {
              try {
                await axios.put(`${getApiUrl()}/api/reports/teller/${selected._id}`, fields);
                showToast({ type: "success", message: "Report updated" });
                setEditing(false);
                fetchList();
                fetchDetails(selected.userId);
              } catch (err) {
                showToast({ type: "error", message: "Failed to update report" });
              }
            }} />
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="mb-2"><strong>Teller:</strong> {selected.tellerName || selected.userId}</div>
                  <div className="mb-2"><strong>Date:</strong> {formatDateTime(selected.createdAt || selected.date)}</div>
                  <div className="mb-2"><strong>System Balance:</strong> ₱{Number(selected.systemBalance || 0).toLocaleString()}</div>
                  <div className="mb-2"><strong>Cash On Hand:</strong> ₱{Number(selected.cashOnHand || selected.totalFromDenom || 0).toLocaleString()}</div>
                  
                  {/* Short with Payment Terms */}
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <strong>Short:</strong> 
                      <span className="text-red-600">₱{Number(selected.short || 0).toLocaleString()}</span>
                    </div>
                    {user?.role === "super_admin" && selected.short > 0 && (
                      <div className="flex flex-col gap-1 mt-1 ml-4">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Payment Terms (weeks):</label>
                          <input
                            type="number"
                            min="1"
                            value={paymentTermsInput}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setPaymentTermsInput(val);
                            }}
                            onBlur={(e) => {
                              handleUpdateShortPaymentTerms(selected._id, e.target.value);
                            }}
                            className={`w-20 px-2 py-1 text-xs rounded border ${dark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-300"}`}
                          />
                        </div>
                        <div className="text-xs">
                          <span className="text-gray-500">Weekly deduction:</span>
                          <span className={`ml-1 font-semibold ${dark ? "text-red-400" : "text-red-600"}`}>
                            ₱{(Number(selected.short || 0) / paymentTermsInput).toFixed(2)}
                          </span>
                          <span className="text-gray-500 ml-1">per week for {paymentTermsInput} {paymentTermsInput === 1 ? 'week' : 'weeks'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-2"><strong>Over:</strong> ₱{Number(selected.over || 0).toLocaleString()}</div>
                </div>

                <div>
                  <div className="mb-2"><strong>Denominations</strong></div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>₱1000: {Number(selected.pcs1000 || selected.d1000 || 0)}</div>
                    <div>₱500: {Number(selected.pcs500 || selected.d500 || 0)}</div>
                    <div>₱200: {Number(selected.pcs200 || selected.d200 || 0)}</div>
                    <div>₱100: {Number(selected.pcs100 || selected.d100 || 0)}</div>
                    <div>₱50: {Number(selected.pcs50 || selected.d50 || 0)}</div>
                    <div>₱20: {Number(selected.pcs20 || selected.d20 || 0)}</div>
                    <div>Coins: ₱{Number(selected.coins || selected.pcsCoins || 0).toLocaleString()}</div>
                    <div>Total Denomination: ₱{Number(selected.totalFromDenom || selected.totalDenomination || 0).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm mb-1">Admin - Total Bet (manual)</label>
                <div className="flex gap-2 items-center">
                  <input
                    defaultValue={selected.totalBet ?? ""}
                    onBlur={(e) => handleUpdateTotalBet(selected.userId, e.target.value)}
                    className="input-box w-48"
                    type="number"
                  />
                  <div className="text-sm text-gray-500">Points = TotalBet / 1000 (calculated on backend)</div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                {selected.verified && <div className="px-3 py-1 bg-green-600 text-white rounded">Verified</div>}
                {selected.approved && <div className="px-3 py-1 bg-indigo-600 text-white rounded">Approved</div>}
                {!selected.verified && !selected.approved && <div className="px-3 py-1 bg-yellow-400 text-black rounded">Pending</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
// ...existing code...
