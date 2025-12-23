import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";
import {
  Loader2,
  RefreshCw,
  DollarSign,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardList,
  Edit2,
  Save,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";

const DEV_SUPERVISOR_ID = import.meta.env.VITE_DEV_SUPERVISOR_ID || "690ec9c92dfa944ee4054180"; // safe dev fallback

export default function TellerManagement() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [tellers, setTellers] = useState([]); // overview list (assigned)
  const [loading, setLoading] = useState(false);
  const [allTellers, setAllTellers] = useState([]); // form list (all)
  const [formTellersLoading, setFormTellersLoading] = useState(false);
  const [selectedTellers, setSelectedTellers] = useState([]); // Multiple teller selection
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [actionType, setActionType] = useState(""); // capital, additional, remit
  const [availableActions, setAvailableActions] = useState(["capital"]); // default: form allows only capital
  const [submitting, setSubmitting] = useState(false);
  const [actionPickerFor, setActionPickerFor] = useState(null); // tellerId showing action picker in overview
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]); // Date filter
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]); // Date range start
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]); // Date range end
  const [showDateRange, setShowDateRange] = useState(false); // Toggle between single date and range
  const [editingRow, setEditingRow] = useState(null); // Track which row is being edited
  const [editValues, setEditValues] = useState({}); // Store edit values
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { tellerId, tellerName, capitalId } or null
  const [deleting, setDeleting] = useState(false); // Loading state for delete action
  const formRef = useRef(null);

  // ✅ Helper function to format number with commas
  const formatNumberWithCommas = (value) => {
    if (!value) return '';
    const num = value.toString().replace(/,/g, '');
    if (isNaN(num)) return value;
    return Number(num).toLocaleString('en-US');
  };

  // ✅ Helper function to parse comma-formatted number
  const parseFormattedNumber = (value) => {
    if (!value) return '';
    return value.toString().replace(/,/g, '');
  };

  // ✅ Fetch available actions based on teller's capital status (used when selecting from overview)
  const fetchAvailableActions = async (tellerId, forOverview = false) => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      
      const response = await axios.get(`${getApiUrl()}/api/teller-management/${tellerId}/available-transactions`, headers);
      const types = response.data.availableTypes || [];
      const actions = types.map(type => {
        if (type === 'capital') return 'capital';
        if (type === 'additional') return 'additional';
        if (type === 'remittance') return 'remit';
        return type;
      });
      if (forOverview) return actions; // don't bind to form, just return list for overview buttons
      // Form stays restricted to capital only per requirement; ignore other actions here.
      setAvailableActions(['capital']);
      setActionType('capital');
    } catch (err) {
      console.error("Failed to fetch available actions:", err);
      if (forOverview) return ['capital'];
      setAvailableActions(['capital']);
      setActionType('capital');
    }
  };

  // ✅ Fetch assigned tellers for overview (supervisor-limited) or all for admin overview
  const fetchTellers = async () => {
    setLoading(true);
    try {
      if (user?.role === 'admin' || user?.role === 'super_admin') {
        // Admin overview uses the filtered admin endpoint (only tellers with transactions today)
        const token = localStorage.getItem('token');
        const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        
        const allRes = await axios.get(`${getApiUrl()}/api/admin/teller-overview`, { 
          params: { date: selectedDate },
          ...headers
        });
        // Response structure: { success, tellers: [...], summary, date }
        const tellerData = allRes.data?.tellers || [];
        setTellers(tellerData);
        return;
      }
      const storedUser = (() => {
        try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
      })();
      let supervisorId = user?._id || user?.id || storedUser?._id || storedUser?.id || (import.meta.env.DEV ? DEV_SUPERVISOR_ID : undefined);
      if (supervisorId && typeof supervisorId === 'object') supervisorId = supervisorId._id || supervisorId.id || String(supervisorId);
      if (!supervisorId) { setTellers([]); return; }
      
      // Add date range parameters if viewing historical data
      const token = localStorage.getItem('token');
      const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      
      const params = { supervisorId };
      if (showDateRange && startDate && endDate) {
        // Use date range for historical view
        params.startDate = startDate;
        params.endDate = endDate;
      } else {
        // Use single date (default current behavior)
        params.dateKey = selectedDate;
      }
      
      const res = await axios.get(`${getApiUrl()}/api/teller-management/tellers`, { 
        params,
        ...headers
      });
      const data = Array.isArray(res.data) ? res.data : (res.data?.tellers || res.data?.reports || []);
      setTellers(data || []);
    } catch (err) {
      console.error("❌ Failed to fetch tellers:", err?.response?.data || err?.message || err);
      showToast({ type: "error", message: "Failed to fetch teller data" });
      setTellers([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch all tellers AND supervisors for the transaction form (supervisor can add capital to any teller or supervisor)
  const fetchAllTellersForForm = async () => {
    setFormTellersLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      
      // Fetch both tellers and supervisors
      const [tellersRes, supervisorsRes] = await Promise.all([
        axios.get(`${getApiUrl()}/api/users`, { params: { role: 'teller' }, ...headers }),
        axios.get(`${getApiUrl()}/api/users`, { params: { role: 'supervisor' }, ...headers })
      ]);

      const tellers = tellersRes.data || [];
      const supervisors = supervisorsRes.data || [];

      // Combine and sort by name
      const allUsers = [...tellers, ...supervisors].sort((a,b) =>
        (a.name||a.username||'').localeCompare(b.name||b.username||'')
      );

      setAllTellers(allUsers);
    } catch (err) {
      console.error('❌ Failed to fetch users for form:', err?.response?.data || err?.message || err);
      setAllTellers([]);
    } finally {
      setFormTellersLoading(false);
    }
  };

  // ✅ Auto fetch lists + real-time sync
  useEffect(() => {
    if (user?._id || import.meta.env.DEV) {
      fetchTellers(); // overview (assigned)
      fetchAllTellersForForm(); // form (all)
      setAvailableActions(['capital']);
      setActionType('');
    }

    // 🔁 Live updates
    const updateHandler = () => { fetchTellers(); fetchAllTellersForForm(); };
    const socket = getGlobalSocket();
    if (socket) {
      socket.on("tellerManagementUpdated", updateHandler);
      socket.on("supervisorReportUpdated", updateHandler);
      socket.on("tellerReportCreated", updateHandler);
      socket.on("transactionUpdated", updateHandler);

      return () => {
        socket.off("tellerManagementUpdated", updateHandler);
        socket.off("supervisorReportUpdated", updateHandler);
        socket.off("tellerReportCreated", updateHandler);
        socket.off("transactionUpdated", updateHandler);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, selectedDate, startDate, endDate, showDateRange]); // Added date range dependencies

  const handleSubmit = async () => {
    if (selectedTellers.length === 0 || !amount) {
      showToast({ type: "info", message: "Please select teller(s) and enter amount" });
      return;
    }

    if (!actionType || !availableActions.includes(actionType)) {
      showToast({ type: "error", message: "Please select a valid action type" });
      return;
    }

    if (Number(amount) <= 0) {
      showToast({ type: "error", message: "Amount must be greater than 0" });
      return;
    }

    setSubmitting(true);

    try {
      const promises = selectedTellers.map(async (teller) => {
        const token = localStorage.getItem('token');
        const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        
        if (actionType === "capital") {
          return axios.post(`${getApiUrl()}/api/teller-management/add-capital`, {
            tellerId: teller._id,
            supervisorId: user?._id,
            amount: Number(amount),
            note,
            performedBy: user?.name || user?.username,
          }, headers);
        } else if (actionType === "additional") {
          return axios.put(
            `${getApiUrl()}/api/teller-management/${teller._id}/add-capital`,
            {
              amount: Number(amount),
              note,
              userId: user?._id,
            },
            headers
          );
        } else if (actionType === "remit") {
          return axios.put(`${getApiUrl()}/api/teller-management/${teller._id}/remit`, {
            amount: Number(amount),
            note,
            userId: user?._id,
          }, headers);
        }
      });

      await Promise.all(promises);

      showToast({ type: "success", message: `Transaction completed for ${selectedTellers.length} teller(s)` });

      setAmount("");
      setNote("");
      setSelectedTellers([]);
      
      // Refresh available actions for the still-selected tellers
      if (selectedTellers.length > 0) {
        // For multiple tellers, we'll just reset to capital
        setAvailableActions(['capital']);
        setActionType('capital');
      }
      
      fetchTellers();
    } catch (err) {
      console.error("❌ Submit error:", err?.response?.data || err);
      showToast({ type: "error", message: "Failed to process request for some tellers" });
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Admin Edit Functions
  const handleStartEdit = (teller) => {
    setEditingRow(teller._id);
    setEditValues({
      baseCapital: teller.baseCapital || 0,
      additionalCapital: teller.additionalCapital || 0,
      remitted: teller.activeCapital?.totalRemitted || 0,
    });
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
    setEditValues({});
  };

  const handleSaveEdit = async (tellerId) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      
      // Update via API - you'll need to create this endpoint
      await axios.put(`${getApiUrl()}/api/teller-management/${tellerId}/update-values`, {
        baseCapital: Number(editValues.baseCapital),
        additionalCapital: Number(editValues.additionalCapital),
        totalRemitted: Number(editValues.remitted),
      }, headers);

      showToast({ type: "success", message: "Teller data updated successfully" });
      setEditingRow(null);
      setEditValues({});
      fetchTellers();
    } catch (err) {
      console.error("❌ Update error:", err?.response?.data || err);
      showToast({ type: "error", message: "Failed to update teller data" });
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Delete Capital Handler
  const handleDeleteCapital = async () => {
    if (!deleteConfirmation) return;
    
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      
      const { tellerId, capitalId } = deleteConfirmation;
      
      await axios.delete(
        `${getApiUrl()}/api/teller-management/${tellerId}/capital/${capitalId}`,
        headers
      );

      showToast({ type: "success", message: `Capital removed and base salary reset to 0 for ${deleteConfirmation.tellerName}` });
      setDeleteConfirmation(null);
      fetchTellers();
    } catch (err) {
      console.error("❌ Delete error:", err?.response?.data || err);
      showToast({ type: "error", message: "Failed to delete capital" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`p-6 min-h-screen ${
        dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Capital Management
        </h1>

        <div className="flex items-center gap-3">
          {/* Date Filter */}
          <div className="flex items-center gap-2">
            {!showDateRange ? (
              <>
                <label className="text-sm font-medium">Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={`px-3 py-1 rounded border text-sm ${
                    dark 
                      ? "bg-gray-800 border-gray-600 text-gray-100" 
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
                {user?.role === 'super_admin' && (
                  <button
                    onClick={() => setShowDateRange(true)}
                    className="px-3 py-1 rounded bg-gray-500 hover:bg-gray-600 text-white text-sm"
                    title="View historical data by date range"
                  >
                    📅 Range
                  </button>
                )}
              </>
            ) : (
              <>
                <label className="text-sm font-medium">From:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`px-3 py-1 rounded border text-sm ${
                    dark 
                      ? "bg-gray-800 border-gray-600 text-gray-100" 
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
                <label className="text-sm font-medium">To:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`px-3 py-1 rounded border text-sm ${
                    dark 
                      ? "bg-gray-800 border-gray-600 text-gray-100" 
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
                <button
                  onClick={() => setShowDateRange(false)}
                  className="px-3 py-1 rounded bg-gray-500 hover:bg-gray-600 text-white text-sm"
                  title="Back to single date view"
                >
                  📅 Single
                </button>
              </>
            )}
          </div>

          <button
            onClick={fetchTellers}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Transaction Form - Only show for supervisors */}
      {user?.role !== 'admin' && (
      <div
        ref={formRef}
        className={`p-6 mb-6 rounded-lg shadow-lg max-w-2xl mx-auto ${
          dark
            ? "bg-gray-800 border border-gray-700"
            : "bg-white border border-gray-200"
        }`}
        onClick={(e) => {
          // Close dropdown when clicking outside
          if (!e.target.closest('#teller-dropdown') && !e.target.closest('.dropdown-trigger')) {
            const dropdown = document.getElementById('teller-dropdown');
            dropdown?.classList.add('hidden');
          }
        }}
      >
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Transaction Form
          </h2>
          <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-600"}`}>
            Add starting capital to any teller. For additional or remittance, select teller in overview below and use quick actions.
          </p>
        </div>

        <div className="space-y-5">
          {/* Teller Selection */}
          <div className="space-y-2">
            <label className={`block text-sm font-semibold ${dark ? "text-gray-200" : "text-gray-700"}`}>
              Select Teller(s)
            </label>
            <div className="relative">
              <div
                className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer dropdown-trigger ${
                  dark 
                    ? "bg-gray-700 border-gray-600 text-gray-100" 
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                onClick={() => {
                  const dropdown = document.getElementById('teller-dropdown');
                  dropdown?.classList.toggle('hidden');
                }}
              >
                <div className="flex items-center justify-between">
                  <span>
                    {selectedTellers.length === 0 
                      ? "Choose teller(s)..." 
                      : `${selectedTellers.length} teller(s) selected`
                    }
                  </span>
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Multi-select dropdown */}
              <div
                id="teller-dropdown"
                className={`absolute z-50 w-full mt-1 rounded-lg border shadow-lg max-h-60 overflow-y-auto hidden ${
                  dark 
                    ? "bg-gray-700 border-gray-600" 
                    : "bg-white border-gray-300"
                }`}
              >
                {formTellersLoading && <div className="p-3 text-center text-gray-400">Loading users...</div>}
                {!formTellersLoading && (
                  <>
                    {/* Tellers Group */}
                    <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                      <div className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 ${dark ? "text-gray-400" : "text-gray-500"}`}>
                        🧾 Tellers
                      </div>
                      {allTellers.filter(u => u.role === 'teller' || u.role === 'supervisor_teller').map((t) => (
                        <label key={t._id} className={`flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer ${dark ? "text-gray-100" : "text-gray-900"}`}>
                          <input
                            type="checkbox"
                            checked={selectedTellers.some(st => st._id === t._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTellers(prev => [...prev, t]);
                              } else {
                                setSelectedTellers(prev => prev.filter(st => st._id !== t._id));
                              }
                              // Reset to capital when selection changes
                              setAvailableActions(['capital']);
                              setActionType('capital');
                            }}
                            className="mr-3 w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          {t.name || t.username} (Teller)
                        </label>
                      ))}
                    </div>

                    {/* Supervisors Group */}
                    <div className="p-2">
                      <div className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 ${dark ? "text-gray-400" : "text-gray-500"}`}>
                        👔 Supervisors
                      </div>
                      {allTellers.filter(u => u.role === 'supervisor').map((s) => (
                        <label key={s._id} className={`flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer ${dark ? "text-gray-100" : "text-gray-900"}`}>
                          <input
                            type="checkbox"
                            checked={selectedTellers.some(st => st._id === s._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTellers(prev => [...prev, s]);
                              } else {
                                setSelectedTellers(prev => prev.filter(st => st._id !== s._id));
                              }
                              // Reset to capital when selection changes
                              setAvailableActions(['capital']);
                              setActionType('capital');
                            }}
                            className="mr-3 w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          {s.name || s.username} (Supervisor)
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Selected Tellers Display */}
            {selectedTellers.length > 0 && (
              <div className={`p-3 rounded-lg border ${dark ? "bg-blue-900/20 border-blue-700/50" : "bg-blue-50 border-blue-200"}`}>
                <div className={`text-sm font-medium mb-2 ${dark ? "text-blue-400" : "text-blue-600"}`}>
                  Selected Tellers ({selectedTellers.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTellers.map((teller) => (
                    <span
                      key={teller._id}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        dark ? "bg-blue-900/50 text-blue-300" : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {teller.name || teller.username}
                      <button
                        onClick={() => {
                          setSelectedTellers(prev => prev.filter(st => st._id !== teller._id));
                        }}
                        className={`ml-1 hover:text-red-500 ${dark ? "text-blue-400" : "text-blue-600"}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status Message - Dynamic based on selected tellers */}
          {selectedTellers.length > 0 && (
            <div className={`p-4 rounded-lg border ${
              selectedTellers.every(t => t.activeCapital?.status === "active")
                ? dark ? "bg-green-900/20 border-green-700/50" : "bg-green-50 border-green-200"
                : selectedTellers.some(t => t.activeCapital?.status === "active")
                ? dark ? "bg-yellow-900/20 border-yellow-700/50" : "bg-yellow-50 border-yellow-200"
                : dark ? "bg-amber-900/20 border-amber-700/50" : "bg-amber-50 border-amber-200"
            }`}>
              {selectedTellers.every(t => t.activeCapital?.status === "active") ? (
                <div className={`flex items-center gap-3 ${dark ? "text-green-400" : "text-green-600"}`}>
                  <ArrowUpCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">
                    All selected users have active capital - you can add more or collect remittance
                  </span>
                </div>
              ) : selectedTellers.some(t => t.activeCapital?.status === "active") ? (
                <div className={`flex items-center gap-3 ${dark ? "text-yellow-400" : "text-yellow-600"}`}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">
                    Mixed status: Some users have active capital, others need initial capital
                  </span>
                </div>
              ) : (
                <div className={`flex items-center gap-3 ${dark ? "text-amber-400" : "text-amber-600"}`}>
                  <ArrowDownCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">
                    Selected users need starting capital before other transactions
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Transaction Details */}
          {selectedTellers.length > 0 && (
            <div className={`p-4 rounded-lg border space-y-4 ${
              dark ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"
            }`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block mb-2 text-sm font-semibold ${dark ? "text-gray-200" : "text-gray-700"}`}>
                    Transaction Type
                  </label>
                  {(actionType === 'additional' || actionType === 'remit') ? (
                    <div className={`p-3 rounded-lg border ${dark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {actionType === 'additional' ? '➕ Additional (selected from overview)' : '💵 Remittance (selected from overview)'}
                        </span>
                        <button
                          className={`text-xs underline ${dark ? 'text-indigo-300' : 'text-indigo-700'}`}
                          onClick={() => { setActionType(''); setAvailableActions(['capital']); }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      disabled={selectedTellers.length === 0}
                      className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none ${
                        dark 
                          ? "bg-gray-700 border-gray-600 text-gray-100" 
                          : "bg-white border-gray-300 text-gray-900"}
                        ${(selectedTellers.length === 0) ? ' opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="">Select type...</option>
                      <option value="capital">💰 Add Capital</option>
                    </select>
                  )}
                  {actionType && (
                    <p className={`mt-2 text-xs ${dark ? "text-gray-400" : "text-gray-500"}`}>
                      {actionType === 'capital' && '→ Create new starting capital for this teller'}
                      {actionType === 'additional' && '→ Add more money to existing capital'}
                      {actionType === 'remit' && '→ Record money collected from teller'}
                    </p>
                  )}
                </div>

                <div>
                  <label className={`block mb-2 text-sm font-semibold ${dark ? "text-gray-200" : "text-gray-700"}`}>
                    Amount
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={formatNumberWithCommas(amount)}
                      onChange={(e) => setAmount(parseFormattedNumber(e.target.value))}
                      className={`w-full pl-10 pr-4 p-3 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                        dark 
                          ? "bg-gray-700 border-gray-600 text-gray-100" 
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholder="Enter amount..."
                    />
                  </div>
                </div>
              </div>

              {/* Note Field */}
              <div>
                <label className={`block mb-2 text-sm font-semibold ${dark ? "text-gray-200" : "text-gray-700"}`}>
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                    dark 
                      ? "bg-gray-700 border-gray-600 text-gray-100" 
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                  placeholder="Add a note about this transaction..."
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          {selectedTellers.length > 0 && (
            <div className="pt-4">
              <button
                disabled={submitting || selectedTellers.length === 0 || !actionType || !amount}
                onClick={handleSubmit}
                className={`w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-lg font-semibold text-white text-base transition-all transform ${
                  submitting || selectedTellers.length === 0 || !actionType || !amount
                    ? 'bg-gray-500 cursor-not-allowed opacity-50' 
                    : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing {selectedTellers.length} Transaction(s)...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5" />
                    <span>Submit Transaction for {selectedTellers.length} Teller(s)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Teller Table */}
      <div
        className={`rounded-lg shadow-lg p-4 ${
          dark
            ? "bg-gray-800 border border-gray-700"
            : "bg-white border border-gray-200"
        }`}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            {user?.role === 'admin' ? 'All Tellers Overview' : 'Tellers Overview'}
            {!loading && tellers.length > 0 && (
              <span className={`text-xs font-normal ${dark ? "text-gray-400" : "text-gray-500"}`}>
                ({tellers.filter(t => t.activeCapital).length} with transactions)
              </span>
            )}
          </h2>
          {selectedDate !== new Date().toISOString().split("T")[0] && !showDateRange && (
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${
              dark ? "bg-amber-900 text-amber-200" : "bg-amber-100 text-amber-800"
            }`}>
              📅 Viewing: {new Date(selectedDate + 'T00:00:00').toLocaleDateString()}
            </span>
          )}
          {showDateRange && startDate && endDate && (
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${
              dark ? "bg-blue-900 text-blue-200" : "bg-blue-100 text-blue-800"
            }`}>
              📅 Historical View: {new Date(startDate + 'T00:00:00').toLocaleDateString()} - {new Date(endDate + 'T00:00:00').toLocaleDateString()}
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin w-5 h-5" /> Loading tellers...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className={`${dark ? "bg-gray-700" : "bg-gray-200"}`}>
                  <th className="border px-3 py-2 text-left">Teller Name</th>
                  {user?.role === 'admin' && (
                    <th className="border px-3 py-2 text-left">Supervisor</th>
                  )}
                  <th className="border px-3 py-2 text-right">Capital</th>
                  <th className="border px-3 py-2 text-right">Additional (Total)</th>
                  <th className="border px-3 py-2 text-right">+Today</th>
                  <th className="border px-3 py-2 text-right">Remitted (Total)</th>
                  <th className="border px-3 py-2 text-right">-Today</th>
                  <th className="border px-3 py-2 text-right">Remaining</th>
                  <th className="border px-3 py-2 text-center">Status</th>
                  <th className="border px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tellers.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'admin' ? 10 : 9} className="text-center py-10 text-gray-400">
                      No tellers found.
                    </td>
                  </tr>
                ) : (
                  tellers
                    // Supervisor: hide tellers without capital added for the day
                    .filter(t => {
                      if (user?.role === 'admin') return true; // Admin sees all
                      return (t.baseCapital > 0 || t.additionalCapital > 0); // Supervisor only sees tellers with capital
                    })
                    // Admin and supervisor only see tellers with capital/transactions
                    // Show all assigned tellers, even if no active capital
                    .map((t) => {
                    const active = t.activeCapital;
                    const isActive = active?.status === "active";
                    return (
                      <tr
                        key={t._id}
                        className={`h-12 transition-colors ${
                          isActive 
                            ? dark 
                              ? "bg-green-900/20 hover:bg-green-900/30" 
                              : "bg-green-50 hover:bg-green-100"
                            : dark
                            ? "hover:bg-gray-700/30"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className={`border px-3 flex items-center gap-2 ${
                          dark ? "border-gray-700" : "border-gray-200"
                        }`}>
                          {/* ✅ Active/Inactive bubble */}
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isActive ? "bg-green-500" : "bg-gray-400"
                            }`}
                            title={
                              isActive
                                ? "Active Capital"
                                : "No Active Capital"
                            }
                          ></span>
                          <div className="flex items-center gap-2">
                            <button
                              className={`text-left hover:underline ${dark ? 'text-indigo-300' : 'text-indigo-700'}`}
                              onClick={async () => {
                                setActionPickerFor(prev => prev === t._id ? null : t._id);
                              }}
                              title="Select actions"
                            >
                              {t.name || t.username}
                            </button>
                            {/* Role indicator */}
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              t.role === 'supervisor' 
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            }`}>
                              {t.role === 'supervisor' ? 'Supervisor' : 'Teller'}
                            </span>
                          </div>
                          {actionPickerFor === t._id && (
                            <div className="mt-2 flex gap-2">
                              <button
                                className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                                onClick={async () => {
                                  // Check if teller has active capital for additional
                                  if (!t.activeCapital) {
                                    showToast({ type: 'warning', message: 'Additional not available (no active capital).' });
                                    return;
                                  }
                                  setSelectedTellers([t]);
                                  setAvailableActions(['additional']);
                                  setActionType('additional');
                                  formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                              >
                                ➕ Additional
                              </button>
                              <button
                                className="px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                onClick={async () => {
                                  // Check if teller has active capital for remittance
                                  if (!t.activeCapital) {
                                    showToast({ type: 'warning', message: 'Remittance not available (no active capital).' });
                                    return;
                                  }
                                  setSelectedTellers([t]);
                                  setAvailableActions(['remit']);
                                  setActionType('remit');
                                  formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                              >
                                💵 Remittance
                              </button>
                            </div>
                          )}
                        </td>
                        {user?.role === 'admin' && (
                          <td className={`border px-3 text-left ${
                            dark ? "border-gray-700 text-gray-100" : "border-gray-200 text-gray-900"
                          }`}>
                            {t.supervisorName || t.supervisor?.name || "Not assigned"}
                          </td>
                        )}
                        <td className={`border px-3 text-right ${
                          dark ? "border-gray-700 text-gray-100" : "border-gray-200 text-gray-900"
                        }`}>
                          {editingRow === t._id ? (
                            <input
                              type="text"
                              value={formatNumberWithCommas(editValues.baseCapital)}
                              onChange={(e) => setEditValues({...editValues, baseCapital: parseFormattedNumber(e.target.value)})}
                              className={`w-full px-2 py-1 text-right border rounded ${
                                dark ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
                              }`}
                            />
                          ) : (
                            `₱${Number(t.baseCapital || 0).toLocaleString()}`
                          )}
                        </td>
                        <td className={`border px-3 text-right ${
                          dark ? "border-gray-700 text-emerald-400" : "border-gray-200 text-emerald-600"
                        }`}>
                          {editingRow === t._id ? (
                            <input
                              type="text"
                              value={formatNumberWithCommas(editValues.additionalCapital)}
                              onChange={(e) => setEditValues({...editValues, additionalCapital: parseFormattedNumber(e.target.value)})}
                              className={`w-full px-2 py-1 text-right border rounded ${
                                dark ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
                              }`}
                            />
                          ) : (
                            `₱${Number(t.additionalCapital || 0).toLocaleString()}`
                          )}
                        </td>
                        <td className={`border px-3 text-right font-semibold ${
                          dark ? "border-gray-700 text-blue-400" : "border-gray-200 text-blue-600"
                        }`}>
                          ₱{Number(t.additionalToday || 0).toLocaleString()}
                        </td>
                        <td className={`border px-3 text-right ${
                          dark ? "border-gray-700 text-green-400" : "border-gray-200 text-green-600"
                        }`}>
                          {editingRow === t._id ? (
                            <input
                              type="text"
                              value={formatNumberWithCommas(editValues.remitted)}
                              onChange={(e) => setEditValues({...editValues, remitted: parseFormattedNumber(e.target.value)})}
                              className={`w-full px-2 py-1 text-right border rounded ${
                                dark ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
                              }`}
                            />
                          ) : (
                            `₱${Number(active?.totalRemitted || 0).toLocaleString()}`
                          )}
                        </td>
                        <td className={`border px-3 text-right font-semibold ${
                          dark ? "border-gray-700 text-orange-400" : "border-gray-200 text-orange-600"
                        }`}>
                          ₱{Number(t.remittanceToday || 0).toLocaleString()}
                        </td>
                        <td className={`border px-3 text-right ${
                          dark ? "border-gray-700 text-yellow-400" : "border-gray-200 text-yellow-600"
                        }`}>
                          ₱{Number(
                            (t.baseCapital || 0) + (t.additionalCapital || 0) - (active?.totalRemitted || 0)
                          ).toLocaleString()}
                        </td>
                        <td className={`border px-3 text-center ${
                          dark ? "border-gray-700" : "border-gray-200"
                        }`}>
                          {active?.status === "completed" ? (
                            <span className="text-green-500 font-semibold">
                              Completed
                            </span>
                          ) : active?.status === "active" ? (
                            <span className="text-blue-400 font-semibold">
                              Active
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className={`border px-3 text-center ${
                          dark ? "border-gray-700" : "border-gray-200"
                        }`}>
                          {editingRow === t._id && user?.role === 'admin' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSaveEdit(t._id)}
                                disabled={submitting}
                                className="px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-xs flex items-center gap-1"
                                title="Save changes"
                              >
                                <Save className="w-3 h-3" />
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={submitting}
                                className="px-2 py-1 rounded bg-gray-600 hover:bg-gray-700 text-white text-xs flex items-center gap-1"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              {user?.role === 'admin' && (
                                <button
                                  onClick={() => handleStartEdit(t)}
                                  className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center gap-1"
                                  title="Edit values"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </button>
                              )}
                              {active?.status === "active" && (
                                <button
                                  onClick={() => setDeleteConfirmation({
                                    tellerId: t._id,
                                    tellerName: t.name || t.username,
                                    capitalId: active._id
                                  })}
                                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs flex items-center gap-1"
                                  title="Delete capital and reset base salary"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🗑️ Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg shadow-2xl max-w-md w-full p-6 ${
            dark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
              <h2 className="text-lg font-semibold">Delete Capital?</h2>
            </div>

            <p className={`mb-4 text-sm ${dark ? "text-gray-300" : "text-gray-700"}`}>
              Are you sure you want to delete the capital for <strong>{deleteConfirmation.tellerName}</strong>?
            </p>

            <div className={`p-3 rounded-lg mb-4 border ${
              dark ? "bg-red-900/20 border-red-700/50 text-red-300" : "bg-red-50 border-red-200 text-red-700"
            }`}>
              <p className="text-sm font-medium">This will:</p>
              <ul className="text-xs mt-2 space-y-1 list-disc list-inside">
                <li>Remove the active capital record</li>
                <li>Reset base salary to ₱0</li>
                <li>Delete all related transactions</li>
              </ul>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmation(null)}
                disabled={deleting}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  dark 
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-100" 
                    : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCapital}
                disabled={deleting}
                className="px-4 py-2 rounded text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Capital
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
