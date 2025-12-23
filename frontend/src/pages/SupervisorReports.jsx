import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";
import {
  Printer,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  Calendar,
  Filter,
  FileText,
  X,
} from "lucide-react";

export default function SupervisorReports({ userRole }) {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [reportData, setReportData] = useState(null);
  const [supervisors, setSupervisors] = useState([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [selectedSupervisors, setSelectedSupervisors] = useState([]); // For multi-select
  const [allReports, setAllReports] = useState([]); // Store multiple reports for printing
  const [mergedReportData, setMergedReportData] = useState(null); // Store merged report for display
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [printingAll, setPrintingAll] = useState(false);

  // Date filter state
  const [dateFilter, setDateFilter] = useState({
    date: "",
    enabled: false,
    showAll: false
  });

  const printRef = useRef();

  useEffect(() => {
    if (userRole === "admin" || userRole === "super_admin") {
      fetchSupervisors();
    } else if (userRole === "supervisor" && user?._id) {
      fetchReport(user._id);
    }

    // unified socket handler for live updates
    const handler = () => {
      const id = (userRole === "admin" || userRole === "super_admin") ? selectedSupervisor : user?._id;
      if (id) fetchReport(id);
    };

    const socket = getGlobalSocket();
    if (socket) {
      // preserve your original socket events + add supervisorReportUpdated
      socket.on("reportUpdated", handler);
      socket.on("tellerManagementUpdated", handler);
      socket.on("tellerReportCreated", handler);
      socket.on("supervisorReportUpdated", (data) => {
        // only refresh if the updated supervisor matches current view
        const id = (userRole === "admin" || userRole === "super_admin") ? selectedSupervisor : user?._id;
        if (!id) return;
        if (data && data.supervisorId && String(data.supervisorId) === String(id)) {
          fetchReport(id);
        }
      });

      // also listen for generic transactionUpdated so we catch all updates
      socket.on("transactionUpdated", handler);

      return () => {
        socket.off("reportUpdated", handler);
        socket.off("tellerManagementUpdated", handler);
        socket.off("tellerReportCreated", handler);
        socket.off("supervisorReportUpdated");
        socket.off("transactionUpdated", handler);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, user, selectedSupervisor]);

  async function fetchSupervisors() {
    try {
      const res = await axios.get(`${getApiUrl()}/api/reports/supervisors/list`);
      setSupervisors(res.data || []);
    } catch (err) {
      console.error("Failed to load supervisors", err);
      showToast({ type: "error", message: "Failed to load supervisors" });
    }
  }

  // helper to normalize denom totals as a fallback if backend shape varies
  function normalizeReportData(data) {
    if (!data) return null;
    const clone = JSON.parse(JSON.stringify(data));
    const totals = clone.denominationTotals || clone.denomTotals || {};
    clone.denominationTotals = {
      d1000: Number(totals.d1000 ?? totals.pcs1000 ?? 0),
      d500: Number(totals.d500 ?? totals.pcs500 ?? 0),
      d200: Number(totals.d200 ?? totals.pcs200 ?? 0),
      d100: Number(totals.d100 ?? totals.pcs100 ?? 0),
      d50: Number(totals.d50 ?? totals.pcs50 ?? 0),
      d20: Number(totals.d20 ?? totals.pcs20 ?? 0),
      coins: Number(totals.coins ?? totals.pcsCoins ?? 0),
    };

    // ensure each teller entry has denom fallback and totals
    clone.tellers = (clone.tellers || []).map((t) => {
      const denom = t.denom || {
        d1000: Number(t.d1000 ?? t.pcs1000 ?? 0),
        d500: Number(t.d500 ?? t.pcs500 ?? 0),
        d200: Number(t.d200 ?? t.pcs200 ?? 0),
        d100: Number(t.d100 ?? t.pcs100 ?? 0),
        d50: Number(t.d50 ?? t.pcs50 ?? 0),
        d20: Number(t.d20 ?? t.pcs20 ?? 0),
        coins: Number(t.coins ?? t.pcsCoins ?? 0),
      };
      const totalFromDenom =
        Number(t.totalFromDenom ?? t.totalDenomination ?? 0) ||
        denom.d1000 * 1000 +
          denom.d500 * 500 +
          denom.d200 * 200 +
          denom.d100 * 100 +
          denom.d50 * 50 +
          denom.d20 * 20 +
          denom.coins;
      return {
        ...t,
        denom,
        totalFromDenom,
        systemBalance: Number(t.systemBalance || 0),
        cashOnHand: Number(t.cashOnHand || totalFromDenom || 0),
        short: Number(t.short || 0),
        over: Number(t.over || 0),
      };
    });

    // compute aggregated totals if backend doesn't provide them
    clone.totalSystemBalance =
      Number(clone.totalSystemBalance ?? clone.totalSystem ?? 0) ||
      clone.tellers.reduce((s, r) => s + (Number(r.systemBalance) || 0), 0);
    clone.totalCashOnHand =
      Number(clone.totalCashOnHand ?? clone.totalCash ?? 0) ||
      clone.tellers.reduce((s, r) => s + (Number(r.cashOnHand) || 0), 0);
    clone.totalShort =
      Number(clone.totalShort ?? clone.totalShorts ?? 0) ||
      clone.tellers.reduce((s, r) => s + (Number(r.short) || 0), 0);
    clone.totalOver =
      Number(clone.totalOver ?? clone.totalOvers ?? 0) ||
      clone.tellers.reduce((s, r) => s + (Number(r.over) || 0), 0);

    return clone;
  }

  async function fetchReport(supervisorId) {
    if (!supervisorId) {
      setReportData(null);
      return;
    }
    setLoading(true);
    try {
      // Build query parameters for date filtering
      const params = new URLSearchParams();
      if (dateFilter.enabled && dateFilter.date) {
        // Use the same date for both fromDate and toDate to query a single day
        params.append('fromDate', dateFilter.date);
        params.append('toDate', dateFilter.date);
      }
      if (dateFilter.showAll) {
        params.append('showAll', 'true');
      }
      
      const queryString = params.toString();
      const urlSuffix = queryString ? `?${queryString}` : '';
      
      const res = await axios.get(`${getApiUrl()}/api/reports/supervisor/${supervisorId}${urlSuffix}`);
      setReportData(normalizeReportData(res.data));
    } catch (err) {
      console.error("Failed to load report", err);
      showToast({ type: "error", message: "Failed to load report" });
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleTotalBetChange(tellerId, value) {
    setUpdating(true);
    try {
      await axios.put(`${getApiUrl()}/api/reports/supervisor/update-bet/${tellerId}`, {
        totalBet: Number(value || 0),
      });
      showToast({ type: "success", message: "Total Bet updated" });
      const id = (userRole === "admin" || userRole === "super_admin") ? selectedSupervisor : user?._id;
      if (id) fetchReport(id);
    } catch (err) {
      console.error("Failed to update Total Bet", err);
      showToast({ type: "error", message: "Failed to update Total Bet" });
    } finally {
      setUpdating(false);
    }
  }

  async function handleApprove(tellerId, tellerName) {
    if (!window.confirm(`Approve ${tellerName}'s report and reset capital?`)) return;
    setUpdating(true);
    try {
      await axios.post(`${getApiUrl()}/api/reports/admin/approve/${tellerId}`);
      showToast({ type: "success", message: `${tellerName} approved and capital reset` });
      const id = (userRole === "admin" || userRole === "super_admin") ? selectedSupervisor : user?._id;
      if (id) fetchReport(id);
    } catch (err) {
      console.error("Failed to approve", err);
      showToast({ type: "error", message: "Failed to approve" });
    } finally {
      setUpdating(false);
    }
  }

  function handleExportToGoogleSheets() {
    console.log("🔵 Export clicked - reportData:", reportData);
    
    if (!reportData || !reportData.tellers || reportData.tellers.length === 0) {
      console.warn("⚠️ No report data to export");
      showToast({ type: "warning", message: "No report data to export" });
      return;
    }

    try {
      console.log("📥 Starting export...");
      
      // Get supervisor name
      const supervisorName = userRole === "supervisor" 
        ? user?.name || user?.username 
        : supervisors.find(s => s._id === selectedSupervisor)?.name || "Unknown";

      console.log("👤 Supervisor:", supervisorName);

      // Prepare headers
      const headers = ["Teller Name", "System Balance", "Cash on Hand", "Short", "Over"];

      // Prepare data rows
      const csvRows = [
        ["Supervisor Report - " + supervisorName],
        ["Date: " + new Date().toLocaleDateString()],
        [],
        headers,
        ...reportData.tellers.map(t => [
          t.tellerName || "",
          Number(t.systemBalance || 0),
          Number(t.cashOnHand || 0),
          Number(t.short || 0),
          Number(t.over || 0)
        ]),
        [
          "TOTAL",
          reportData.tellers.reduce((sum, t) => sum + Number(t.systemBalance || 0), 0),
          reportData.tellers.reduce((sum, t) => sum + Number(t.cashOnHand || 0), 0),
          reportData.tellers.reduce((sum, t) => sum + Number(t.short || 0), 0),
          reportData.tellers.reduce((sum, t) => sum + Number(t.over || 0), 0)
        ]
      ];

      console.log("📊 CSV rows prepared:", csvRows.length);

      // Create CSV content
      const csvContent = csvRows.map(row => 
        row.map(cell => {
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return '"' + cellStr.replace(/"/g, '""') + '"';
          }
          return cellStr;
        }).join(',')
      ).join('\n');

      console.log("✏️ CSV content created, length:", csvContent.length);

      // Download using data URI as fallback method
      const fileName = `supervisor_report_${supervisorName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      
      // Try Blob method first
      try {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        console.log("🔗 Blob created, URL:", url);
        
        link.href = url;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        
        console.log("📍 Link appended to DOM");
        
        setTimeout(() => {
          console.log("⬇️ Triggering download...");
          link.click();
          setTimeout(() => { 
            document.body.removeChild(link); 
            URL.revokeObjectURL(url);
            console.log("🧹 Cleanup done");
          }, 500);
        }, 100);
      } catch (blobErr) {
        console.warn("⚠️ Blob method failed, trying data URI:", blobErr);
        // Fallback: use data URI
        const dataUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        const link = document.createElement("a");
        link.href = dataUri;
        link.download = fileName;
        link.click();
      }
      
      showToast({ 
        type: "success", 
        message: "✅ CSV file downloading..." 
      });
      
    } catch (err) {
      console.error("❌ Export error:", err);
      showToast({ type: "error", message: "Failed to export report: " + err.message });
    }
  }

  // Toggle supervisor selection for multi-print
  function toggleSupervisorSelection(supervisorId) {
    setSelectedSupervisors(prev => {
      if (prev.includes(supervisorId)) {
        return prev.filter(id => id !== supervisorId);
      } else {
        return [...prev, supervisorId];
      }
    });
  }

  // Select/Deselect all supervisors
  function toggleSelectAll() {
    if (selectedSupervisors.length === supervisors.length) {
      setSelectedSupervisors([]);
    } else {
      setSelectedSupervisors(supervisors.map(s => s._id));
    }
  }

  // Fetch all reports for selected supervisors and print them
  async function handlePrintAllSelected() {
    if (selectedSupervisors.length === 0) {
      showToast({ type: "warning", message: "Please select at least one supervisor" });
      return;
    }

    setPrintingAll(true);
    try {
      // Build query parameters for date filtering
      const params = new URLSearchParams();
      if (dateFilter.enabled && dateFilter.date) {
        params.append('fromDate', dateFilter.date);
        params.append('toDate', dateFilter.date);
      }
      if (dateFilter.showAll) {
        params.append('showAll', 'true');
      }
      const queryString = params.toString();
      const urlSuffix = queryString ? `?${queryString}` : '';

      // Fetch all selected supervisor reports
      const reports = await Promise.all(
        selectedSupervisors.map(async (supId) => {
          try {
            const res = await axios.get(`${getApiUrl()}/api/reports/supervisor/${supId}${urlSuffix}`);
            return normalizeReportData(res.data);
          } catch (err) {
            console.error(`Failed to load report for supervisor ${supId}`, err);
            return null;
          }
        })
      );

      // Filter out any failed requests
      const validReports = reports.filter(r => r !== null);

      if (validReports.length === 0) {
        showToast({ type: "error", message: "Failed to load any reports" });
        return;
      }

      // Store the merged report for display
      const merged = createMergedReport(validReports);
      setMergedReportData(merged);
      setReportData(null); // Clear single report view
      
    } catch (err) {
      console.error("Failed to load merged reports", err);
      showToast({ type: "error", message: "Failed to load merged reports" });
    } finally {
      setPrintingAll(false);
    }
  }

  // Create merged report data structure
  function createMergedReport(reports) {
    if (!reports || reports.length === 0) return null;

    // Merge all tellers from all supervisors
    const allTellers = [];
    reports.forEach(report => {
      if (report && report.tellers) {
        report.tellers.forEach(teller => {
          allTellers.push({
            ...teller,
            supervisorName: report.supervisorName || 'Unknown'
          });
        });
      }
    });

    // Calculate merged totals
    const mergedTotals = {
      totalSystemBalance: allTellers.reduce((sum, t) => sum + (t.systemBalance || 0), 0),
      totalCashOnHand: allTellers.reduce((sum, t) => sum + (t.cashOnHand || 0), 0),
      totalShort: allTellers.reduce((sum, t) => sum + (t.short || 0), 0),
      totalOver: allTellers.reduce((sum, t) => sum + (t.over || 0), 0)
    };

    // Merge denominations
    const mergedDenoms = {
      d1000: 0, d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, coins: 0
    };
    reports.forEach(report => {
      if (report && report.denominationTotals) {
        mergedDenoms.d1000 += report.denominationTotals.d1000 || 0;
        mergedDenoms.d500 += report.denominationTotals.d500 || 0;
        mergedDenoms.d200 += report.denominationTotals.d200 || 0;
        mergedDenoms.d100 += report.denominationTotals.d100 || 0;
        mergedDenoms.d50 += report.denominationTotals.d50 || 0;
        mergedDenoms.d20 += report.denominationTotals.d20 || 0;
        mergedDenoms.coins += report.denominationTotals.coins || 0;
      }
    });

    // Get supervisor names
    const supervisorNames = reports.map(r => r.supervisorName || 'Unknown').join(', ');

    return {
      supervisorName: supervisorNames,
      supervisorCount: reports.length,
      tellers: allTellers,
      totalSystemBalance: mergedTotals.totalSystemBalance,
      totalCashOnHand: mergedTotals.totalCashOnHand,
      totalShort: mergedTotals.totalShort,
      totalOver: mergedTotals.totalOver,
      denominationTotals: mergedDenoms,
      dateLabel: dateFilter.date || new Date().toLocaleDateString(),
      isMerged: true
    };
  }

  // Export merged report to Google Sheets
  function handleExportMergedReport() {
    console.log("🔵 Merged export clicked - mergedReportData:", mergedReportData);
    
    if (!mergedReportData || !mergedReportData.tellers || mergedReportData.tellers.length === 0) {
      console.warn("⚠️ No merged report data to export");
      showToast({ type: "warning", message: "No merged report data to export" });
      return;
    }

    try {
      console.log("📥 Starting merged export...");
      
      const headers = ["Supervisor", "Teller Name", "System Balance", "Cash on Hand", "Short", "Over"];
      
      const rows = mergedReportData.tellers.map(t => [
        t.supervisorName || "",
        t.tellerName || "",
        Number(t.systemBalance || 0),
        Number(t.cashOnHand || 0),
        Number(t.short || 0),
        Number(t.over || 0)
      ]);

      // Add totals row
      rows.push([
        "TOTAL",
        "",
        mergedReportData.totalSystemBalance,
        mergedReportData.totalCashOnHand,
        mergedReportData.totalShort,
        mergedReportData.totalOver
      ]);

      console.log("📊 Rows prepared:", rows.length);

      // Convert to CSV
      const csvContent = [
        [`Consolidated Supervisor Report`],
        [`Supervisors: ${mergedReportData.supervisorName}`],
        [`Total Supervisors: ${mergedReportData.supervisorCount}`],
        [`Total Tellers: ${mergedReportData.tellers.length}`],
        [`Date: ${mergedReportData.dateLabel}`],
        [],
        headers,
        ...rows
      ].map(row => 
        row.map(cell => {
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return '"' + cellStr.replace(/"/g, '""') + '"';
          }
          return cellStr;
        }).join(',')
      ).join('\n');

      console.log("✏️ CSV content created, length:", csvContent.length);

      // Download using data URI as fallback method
      const fileName = `consolidated_report_${new Date().toISOString().split('T')[0]}.csv`;
      
      // Try Blob method first
      try {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        console.log("🔗 Blob created, URL:", url);
        
        link.href = url;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        
        console.log("📍 Link appended to DOM");
        
        setTimeout(() => {
          console.log("⬇️ Triggering download...");
          link.click();
          setTimeout(() => { 
            document.body.removeChild(link); 
            URL.revokeObjectURL(url);
            console.log("🧹 Cleanup done");
          }, 500);
        }, 100);
      } catch (blobErr) {
        console.warn("⚠️ Blob method failed, trying data URI:", blobErr);
        // Fallback: use data URI
        const dataUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        const link = document.createElement("a");
        link.href = dataUri;
        link.download = fileName;
        link.click();
      }
      
      showToast({ 
        type: "success", 
        message: "✅ CSV file downloading..." 
      });
      
    } catch (err) {
      console.error("❌ Export error:", err);
      showToast({ type: "error", message: "Failed to export report: " + err.message });
    }
  }

  // Print merged report
  function handlePrintMergedReport() {
    if (!mergedReportData) {
      showToast({ type: "warning", message: "No merged report to print" });
      return;
    }
    printMultipleReports([mergedReportData]);
  }

  // Print merged report from multiple supervisors
  function printMultipleReports(reports) {
    if (!reports || reports.length === 0) return;

    // Merge all tellers from all supervisors
    const allTellers = [];
    reports.forEach(report => {
      if (report && report.tellers) {
        report.tellers.forEach(teller => {
          allTellers.push({
            ...teller,
            supervisorName: report.supervisorName || 'Unknown'
          });
        });
      }
    });

    // Calculate merged totals
    const mergedTotals = {
      totalSystemBalance: allTellers.reduce((sum, t) => sum + (t.systemBalance || 0), 0),
      totalCashOnHand: allTellers.reduce((sum, t) => sum + (t.cashOnHand || 0), 0),
      totalShort: allTellers.reduce((sum, t) => sum + (t.short || 0), 0),
      totalOver: allTellers.reduce((sum, t) => sum + (t.over || 0), 0)
    };

    // Merge denominations
    const mergedDenoms = {
      d1000: 0, d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, coins: 0
    };
    reports.forEach(report => {
      if (report && report.denominationTotals) {
        mergedDenoms.d1000 += report.denominationTotals.d1000 || 0;
        mergedDenoms.d500 += report.denominationTotals.d500 || 0;
        mergedDenoms.d200 += report.denominationTotals.d200 || 0;
        mergedDenoms.d100 += report.denominationTotals.d100 || 0;
        mergedDenoms.d50 += report.denominationTotals.d50 || 0;
        mergedDenoms.d20 += report.denominationTotals.d20 || 0;
        mergedDenoms.coins += report.denominationTotals.coins || 0;
      }
    });

    // Get supervisor names for header
    const supervisorNames = reports.map(r => r.supervisorName || 'Unknown').join(', ');

    const reportHtml = `
      <h2>CONSOLIDATED SUPERVISOR COLLECTION REPORT</h2>
      <div class="header">
        <div><strong>Supervisors:</strong> ${supervisorNames}</div>
        <div><strong>Date:</strong> ${dateFilter.date || new Date().toLocaleDateString()}</div>
      </div>
      <div class="header">
        <div><strong>Total Supervisors:</strong> ${reports.length}</div>
        <div><strong>Total Tellers:</strong> ${allTellers.length}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>SUPERVISOR</th>
            <th>TELLER</th>
            <th>SYSTEM BAL</th>
            <th>CASH ON HAND</th>
            <th>SHORT</th>
            <th>OVER</th>
          </tr>
        </thead>
        <tbody>
          ${allTellers.map(t => `
            <tr>
              <td>${t.supervisorName}</td>
              <td>${t.tellerName || 'Unknown'}</td>
              <td>₱${(t.systemBalance || 0).toLocaleString()}</td>
              <td>₱${(t.cashOnHand || 0).toLocaleString()}</td>
              <td class="short">₱${(t.short || 0).toLocaleString()}</td>
              <td class="over">₱${(t.over || 0).toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2"><strong>GRAND TOTAL</strong></td>
            <td><strong>₱${mergedTotals.totalSystemBalance.toLocaleString()}</strong></td>
            <td><strong>₱${mergedTotals.totalCashOnHand.toLocaleString()}</strong></td>
            <td class="short"><strong>₱${mergedTotals.totalShort.toLocaleString()}</strong></td>
            <td class="over"><strong>₱${mergedTotals.totalOver.toLocaleString()}</strong></td>
          </tr>
        </tbody>
      </table>

      <table class="denom-table">
        <thead>
          <tr>
            <th>Denomination</th>
            <th>Total Pieces</th>
            <th>Total Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>₱1000</td><td>${mergedDenoms.d1000}</td><td>₱${(mergedDenoms.d1000 * 1000).toLocaleString()}</td></tr>
          <tr><td>₱500</td><td>${mergedDenoms.d500}</td><td>₱${(mergedDenoms.d500 * 500).toLocaleString()}</td></tr>
          <tr><td>₱200</td><td>${mergedDenoms.d200}</td><td>₱${(mergedDenoms.d200 * 200).toLocaleString()}</td></tr>
          <tr><td>₱100</td><td>${mergedDenoms.d100}</td><td>₱${(mergedDenoms.d100 * 100).toLocaleString()}</td></tr>
          <tr><td>₱50</td><td>${mergedDenoms.d50}</td><td>₱${(mergedDenoms.d50 * 50).toLocaleString()}</td></tr>
          <tr><td>₱20</td><td>${mergedDenoms.d20}</td><td>₱${(mergedDenoms.d20 * 20).toLocaleString()}</td></tr>
          <tr><td>Coins</td><td>${mergedDenoms.coins}</td><td>₱${mergedDenoms.coins.toLocaleString()}</td></tr>
          <tr class="total-row">
            <td colspan="2"><strong>TOTAL CASH</strong></td>
            <td><strong>₱${(
              mergedDenoms.d1000 * 1000 +
              mergedDenoms.d500 * 500 +
              mergedDenoms.d200 * 200 +
              mergedDenoms.d100 * 100 +
              mergedDenoms.d50 * 50 +
              mergedDenoms.d20 * 20 +
              mergedDenoms.coins
            ).toLocaleString()}</strong></td>
          </tr>
        </tbody>
      </table>

      <div class="signature">
        <div class="sig-line">Prepared By</div>
        <div class="sig-line">Verified By</div>
        <div class="sig-line">Admin Signature</div>
      </div>
    `;

    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head>
          <title>Consolidated Report - ${dateFilter.date || new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 20px; }
            h2 { text-align: center; margin: 6px 0; font-size: 16px; }
            .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:13px; }
            table { width:100%; border-collapse: collapse; margin-top: 12px; font-size:11px;}
            th, td { border:1px solid #000; padding:5px; text-align:center; vertical-align: middle; }
            .denom-table { margin-top: 16px; }
            .denom-table th, .denom-table td { text-align:left; }
            .total-row { background-color: #f0f0f0; font-weight: bold; }
            .short { color: #dc2626; }
            .over { color: #16a34a; }
            .signature { margin-top:40px; display:flex; justify-content:space-around; }
            .sig-line { width:30%; border-top:1px solid #000; text-align:center; padding-top:6px; }
            @media print {
              body { margin: 15px; }
            }
          </style>
        </head>
        <body>${reportHtml}</body>
      </html>
    `);
    win.document.close();
    win.print();
  }

  function handlePrint() {
    if (!printRef.current) return;
    
    // Clone the print content and remove TOTAL BET column for printing
    const printElement = printRef.current.cloneNode(true);
    
    // Remove TOTAL BET header
    const totalBetHeaders = printElement.querySelectorAll('th');
    totalBetHeaders.forEach(header => {
      if (header.textContent.includes('TOTAL BET')) {
        header.style.display = 'none';
      }
    });
    
    // Remove TOTAL BET cells from rows
    const totalBetCells = printElement.querySelectorAll('td');
    totalBetCells.forEach((cell, index) => {
      const row = cell.parentElement;
      const cells = Array.from(row.children);
      const cellIndex = cells.indexOf(cell);
      
      // Check if this is the TOTAL BET column (usually 6th column when admin)
      const headers = printElement.querySelectorAll('thead th');
      if (headers[cellIndex] && headers[cellIndex].textContent.includes('TOTAL BET')) {
        cell.style.display = 'none';
      }
    });
    
    // Also remove ACTION column for cleaner print
    const actionHeaders = printElement.querySelectorAll('th');
    actionHeaders.forEach(header => {
      if (header.textContent.includes('ACTION')) {
        header.style.display = 'none';
      }
    });
    
    const actionCells = printElement.querySelectorAll('td');
    actionCells.forEach((cell, index) => {
      const row = cell.parentElement;
      const cells = Array.from(row.children);
      const cellIndex = cells.indexOf(cell);
      
      const headers = printElement.querySelectorAll('thead th');
      if (headers[cellIndex] && headers[cellIndex].textContent.includes('ACTION')) {
        cell.style.display = 'none';
      }
    });
    
    const html = printElement.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head>
          <title>Supervisor Report</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 20px; }
            h2 { text-align: center; margin: 6px 0; font-size: 16px; }
            .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:13px; }
            table { width:100%; border-collapse: collapse; margin-top: 8px; font-size:12px;}
            th, td { border:1px solid #000; padding:6px; text-align:center; vertical-align: middle; }
            .denom-table th, .denom-table td { text-align:left; }
            .signature { margin-top:40px; display:flex; justify-content:space-between; }
            .sig-line { width:40%; border-top:1px solid #000; text-align:center; padding-top:6px; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  function buildRows() {
    const actual = (reportData?.tellers || []).slice();
    const minimum = 10;
    if (actual.length >= minimum) return actual;
    const placeholders = [];
    for (let i = 0; i < minimum - actual.length; i++) {
      placeholders.push({
        tellerId: `placeholder-${i}`,
        tellerName: "",
        systemBalance: 0,
        cashOnHand: 0,
        short: 0,
        over: 0,
        denom: { d1000: 0, d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, coins: 0 },
        totalFromDenom: 0,
        verified: false,
        approvedByAdmin: false,
      });
    }
    return [...actual, ...placeholders];
  }

  function denomCount(key) {
    return Number(reportData?.denominationTotals?.[key] || 0);
  }

  function denomTotalValue() {
    const totals = reportData?.denominationTotals || {};
    const val =
      (Number(totals.d1000 || 0) * 1000) +
      (Number(totals.d500 || 0) * 500) +
      (Number(totals.d200 || 0) * 200) +
      (Number(totals.d100 || 0) * 100) +
      (Number(totals.d50 || 0) * 50) +
      (Number(totals.d20 || 0) * 20) +
      (Number(totals.coins || 0));
    return val || 0;
  }

  // Top totals: show at top as requested
  const topTotals = {
    totalCashOnHand: Number(reportData?.totalCashOnHand || reportData?.totalCash || 0),
    totalSystemBalance: Number(reportData?.totalSystemBalance || reportData?.totalSystem || 0),
    totalShort: Number(reportData?.totalShort || 0),
    totalOver: Number(reportData?.totalOver || 0),
  };

  return (
    <div className={`p-6 min-h-screen ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Supervisor's Report</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const id = (userRole === "admin" || userRole === "super_admin") ? selectedSupervisor : user?._id;
              if (!id) {
                showToast({ type: "info", message: "Select a supervisor first" });
                return;
              }
              fetchReport(id);
            }}
            className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Refresh
          </button>
          <button
            onClick={handleExportToGoogleSheets}
            disabled={!reportData || !reportData.tellers || reportData.tellers.length === 0}
            className={`flex items-center gap-2 px-3 py-1 rounded text-white ${
              !reportData || !reportData.tellers || reportData.tellers.length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <FileSpreadsheet size={16} />
            Export to Sheets
          </button>
          <button onClick={handlePrint} className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white">
            Print Report
          </button>
        </div>
      </div>

      {(userRole === "admin" || userRole === "super_admin") && (
        <>
          <div className="mb-4">
            <label className="block mb-2 font-medium">Select Supervisor</label>
            <select
              className="p-2 rounded border bg-gray-800 text-gray-100"
              value={selectedSupervisor}
              onChange={(e) => {
                setSelectedSupervisor(e.target.value);
                fetchReport(e.target.value);
              }}
            >
              <option value="">-- Choose Supervisor --</option>
              {supervisors.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name || s.username}
                </option>
              ))}
            </select>
          </div>

          {/* Multi-Select for Super Admin */}
          {userRole === "super_admin" && (
            <div className={`mb-4 p-4 rounded ${dark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
              <div className="flex justify-between items-center mb-3">
                <label className="font-medium">Print Multiple Supervisor Reports</label>
                <div className="flex gap-2">
                  <button
                    onClick={toggleSelectAll}
                    className="px-3 py-1 text-sm rounded bg-gray-600 hover:bg-gray-700 text-white"
                  >
                    {selectedSupervisors.length === supervisors.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={handlePrintAllSelected}
                    disabled={selectedSupervisors.length === 0 || printingAll}
                    className="px-3 py-1 text-sm rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {printingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        Load Reports ({selectedSupervisors.length})
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {supervisors.map((s) => (
                  <label
                    key={s._id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                      selectedSupervisors.includes(s._id)
                        ? 'bg-purple-600 text-white'
                        : dark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSupervisors.includes(s._id)}
                      onChange={() => toggleSupervisorSelection(s._id)}
                      className="rounded"
                    />
                    <span className="text-sm">{s.name || s.username}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Date Filter Section */}
      <div className={`p-4 rounded mb-4 ${dark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5" />
          <span className="font-medium">Date Filter</span>
          <div className="ml-auto flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dateFilter.showAll}
                onChange={(e) => setDateFilter(prev => ({ 
                  ...prev, 
                  showAll: e.target.checked,
                  enabled: e.target.checked ? false : prev.enabled // Disable date range when showing all
                }))}
                className="rounded"
              />
              <span className="text-sm text-orange-600 font-medium">Show All Historical</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dateFilter.enabled}
                onChange={(e) => setDateFilter(prev => ({ 
                  ...prev, 
                  enabled: e.target.checked,
                  showAll: e.target.checked ? false : prev.showAll // Disable show all when using date range
                }))}
                className="rounded"
                disabled={dateFilter.showAll}
              />
              <span className="text-sm">Enable Date Range</span>
            </label>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Select Date:</label>
            <input
              type="date"
              value={dateFilter.date}
              onChange={(e) => setDateFilter(prev => ({ ...prev, date: e.target.value }))}
              disabled={!dateFilter.enabled}
              className={`w-full p-2 border rounded ${
                dark ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
              } ${!dateFilter.enabled ? "opacity-50" : ""}`}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                const id = (userRole === "admin" || userRole === "super_admin") ? selectedSupervisor : user?._id;
                if (!id) {
                  showToast({ type: "info", message: "Select a supervisor first" });
                  return;
                }
                fetchReport(id);
              }}
              disabled={!dateFilter.enabled && !dateFilter.showAll}
              className={`w-full px-4 py-2 rounded flex items-center justify-center gap-2 ${
                (dateFilter.enabled || dateFilter.showAll)
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                  : "bg-gray-400 text-gray-200 cursor-not-allowed"
              }`}
            >
              <Filter className="w-4 h-4" />
              {dateFilter.showAll ? "Show All Reports" : "Apply Filter"}
            </button>
          </div>
        </div>
      </div>

      {/* MERGED REPORT DISPLAY */}
      {mergedReportData && (
        <div className="mb-6">
          <div className={`mb-4 p-4 rounded ${dark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Consolidated Report</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {mergedReportData.supervisorCount} Supervisors • {mergedReportData.tellers.length} Tellers
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportMergedReport}
                  className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export to Sheets
                </button>
                <button
                  onClick={handlePrintMergedReport}
                  className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Report
                </button>
                <button
                  onClick={() => {
                    setMergedReportData(null);
                    setSelectedSupervisors([]);
                  }}
                  className="px-3 py-2 rounded bg-gray-600 hover:bg-gray-700 text-white flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              </div>
            </div>

            {/* Merged Totals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
              <div className="p-2 rounded border bg-indigo-50">
                <div className="text-xs text-gray-600">Total Cash On Hand</div>
                <div className="font-semibold text-lg">₱{Number(mergedReportData.totalCashOnHand).toLocaleString()}</div>
              </div>
              <div className="p-2 rounded border bg-blue-50">
                <div className="text-xs text-gray-600">Total System Balance</div>
                <div className="font-semibold text-lg">₱{Number(mergedReportData.totalSystemBalance).toLocaleString()}</div>
              </div>
              <div className="p-2 rounded border bg-red-50">
                <div className="text-xs text-gray-600">Total Short</div>
                <div className="font-semibold text-lg text-red-600">₱{Number(mergedReportData.totalShort).toLocaleString()}</div>
              </div>
              <div className="p-2 rounded border bg-green-50">
                <div className="text-xs text-gray-600">Total Over</div>
                <div className="font-semibold text-lg text-green-600">₱{Number(mergedReportData.totalOver).toLocaleString()}</div>
              </div>
            </div>

            {/* Merged Tellers Table */}
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm border-collapse">
                <thead>
                  <tr className={`${dark ? "bg-gray-700" : "bg-gray-200"} text-center`}>
                    <th className="py-2 px-2 border">SUPERVISOR</th>
                    <th className="py-2 px-2 border">TELLER'S NAME</th>
                    <th className="py-2 px-2 border">SYSTEM BALANCE</th>
                    <th className="py-2 px-2 border">CASH ON HAND</th>
                    <th className="py-2 px-2 border">SHORT</th>
                    <th className="py-2 px-2 border">OVER</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedReportData.tellers.map((teller, idx) => (
                    <tr key={idx} className="h-10">
                      <td className="px-2 border text-left">{teller.supervisorName}</td>
                      <td className="px-2 border text-left">{teller.tellerName}</td>
                      <td className="px-2 border text-right">₱{Number(teller.systemBalance || 0).toLocaleString()}</td>
                      <td className="px-2 border text-right">₱{Number(teller.cashOnHand || 0).toLocaleString()}</td>
                      <td className="px-2 border text-right">₱{Number(teller.short || 0).toLocaleString()}</td>
                      <td className="px-2 border text-right">₱{Number(teller.over || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className={`font-bold ${dark ? "bg-gray-700" : "bg-gray-200"}`}>
                    <td className="px-2 border text-left" colSpan="2">GRAND TOTAL</td>
                    <td className="px-2 border text-right">₱{Number(mergedReportData.totalSystemBalance).toLocaleString()}</td>
                    <td className="px-2 border text-right">₱{Number(mergedReportData.totalCashOnHand).toLocaleString()}</td>
                    <td className="px-2 border text-right">₱{Number(mergedReportData.totalShort).toLocaleString()}</td>
                    <td className="px-2 border text-right">₱{Number(mergedReportData.totalOver).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Merged Denominations */}
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Consolidated Denomination Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full table-auto text-sm border-collapse">
                  <thead>
                    <tr className={`${dark ? "bg-gray-700" : "bg-gray-200"}`}>
                      <th className="border px-3 py-2">Denomination</th>
                      <th className="border px-3 py-2">Pieces</th>
                      <th className="border px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: "d1000", label: "₱1000", value: 1000 },
                      { key: "d500", label: "₱500", value: 500 },
                      { key: "d200", label: "₱200", value: 200 },
                      { key: "d100", label: "₱100", value: 100 },
                      { key: "d50", label: "₱50", value: 50 },
                      { key: "d20", label: "₱20", value: 20 },
                      { key: "coins", label: "Coins", value: 1 },
                    ].map((d) => {
                      const pcs = mergedReportData.denominationTotals[d.key] || 0;
                      const total = pcs * d.value;
                      return (
                        <tr key={d.key} className="h-10">
                          <td className="border px-3">{d.label}</td>
                          <td className="border px-3 text-center">{pcs}</td>
                          <td className="border px-3 text-right">₱{Number(total).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    <tr className="font-semibold">
                      <td className="border px-3" colSpan="2">TOTAL</td>
                      <td className="border px-3 text-right">
                        ₱{Number(
                          (mergedReportData.denominationTotals.d1000 || 0) * 1000 +
                          (mergedReportData.denominationTotals.d500 || 0) * 500 +
                          (mergedReportData.denominationTotals.d200 || 0) * 200 +
                          (mergedReportData.denominationTotals.d100 || 0) * 100 +
                          (mergedReportData.denominationTotals.d50 || 0) * 50 +
                          (mergedReportData.denominationTotals.d20 || 0) * 20 +
                          (mergedReportData.denominationTotals.coins || 0)
                        ).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOP TOTALS (appears on top) */}
      {reportData && !mergedReportData && (
        <div className={`mb-4 rounded p-3 ${dark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="p-2 rounded border bg-indigo-50">
              <div className="text-xs text-gray-600">Total Cash On Hand</div>
              <div className="font-semibold text-lg">₱{Number(topTotals.totalCashOnHand).toLocaleString()}</div>
            </div>
            <div className="p-2 rounded border bg-blue-50">
              <div className="text-xs text-gray-600">Total System Balance</div>
              <div className="font-semibold text-lg">₱{Number(topTotals.totalSystemBalance).toLocaleString()}</div>
            </div>
            <div className="p-2 rounded border bg-red-50">
              <div className="text-xs text-gray-600">Total Short</div>
              <div className="font-semibold text-lg text-red-600">₱{Number(topTotals.totalShort).toLocaleString()}</div>
            </div>
            <div className="p-2 rounded border bg-green-50">
              <div className="text-xs text-gray-600">Total Over</div>
              <div className="font-semibold text-lg text-green-600">₱{Number(topTotals.totalOver).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {reportData && !mergedReportData && (
      <div
        ref={printRef}
        className={`rounded-lg shadow-lg border ${dark ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"} p-4`}
      >
        <div className="flex justify-between items-center text-sm mb-3">
          <div>
            <strong>Supervisor's Name: </strong>
            <span>{reportData?.supervisorName || (userRole === "supervisor" ? user?.name || user?.username : "N/A")}</span>
          </div>
          <div>
            <strong>Date: </strong>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <h2 className="text-center font-bold mb-3">SUPERVISOR'S REPORT</h2>

        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm border-collapse">
            <thead>
              <tr className={`${dark ? "bg-gray-700" : "bg-gray-200"} text-center`}>
                <th className="py-2 px-2 border">TELLER'S NAME</th>
                <th className="py-2 px-2 border">SYSTEM BALANCE</th>
                <th className="py-2 px-2 border">CASH ON HAND</th>
                <th className="py-2 px-2 border">SHORT</th>
                <th className="py-2 px-2 border">OVER</th>
                {(userRole === "admin" || userRole === "super_admin") && <th className="py-2 px-2 border">TOTAL BET</th>}
                {(userRole === "admin" || userRole === "super_admin") && <th className="py-2 px-2 border">ACTION</th>}
                <th className="py-2 px-2 border">REMARKS</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={(userRole === "admin" || userRole === "super_admin") ? 8 : 6} className="py-20 text-center">Loading...</td>
                </tr>
              ) : (
                <>
                  {buildRows().map((row, idx) => {
                    const isPlaceholder = typeof row.tellerId === "string" && row.tellerId.startsWith("placeholder");
                    const tId = row.tellerId;
                    const remark = row.verified ? (row.approvedByAdmin ? "Approved" : "Verified") : "";
                    return (
                      <tr key={tId || idx} className="h-12">
                        <td className="px-2 border text-left">{row.tellerName || ""}</td>
                        <td className="px-2 border text-right">₱{Number(row.systemBalance || 0).toLocaleString()}</td>
                        <td className="px-2 border text-right">₱{Number(row.cashOnHand || 0).toLocaleString()}</td>
                        <td className="px-2 border text-right text-red-400">₱{Number(row.short || 0).toLocaleString()}</td>
                        <td className="px-2 border text-right text-green-400">₱{Number(row.over || 0).toLocaleString()}</td>

                        {(userRole === "admin" || userRole === "super_admin") && (
                          <td className="px-2 border text-right">
                            {!isPlaceholder ? (
                              <input
                                type="number"
                                className="w-28 p-1 rounded bg-gray-900 text-white"
                                onBlur={(e) => handleTotalBetChange(tId, e.target.value)}
                                placeholder="0"
                                defaultValue={row.totalBet ?? ""}
                                disabled={updating}
                              />
                            ) : (
                              ""
                            )}
                          </td>
                        )}

                        {(userRole === "admin" || userRole === "super_admin") && (
                          <td className="px-2 border text-center">
                            {!isPlaceholder ? (
                              <button
                                disabled={updating}
                                onClick={() => handleApprove(tId, row.tellerName)}
                                className="px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-xs"
                              >
                                {row.approvedByAdmin ? "Approved" : "Approve"}
                              </button>
                            ) : (
                              ""
                            )}
                          </td>
                        )}

                        <td className="px-2 border text-center">{remark}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-semibold bg-gray-100 dark:bg-gray-700">
                    <td className="px-2 border text-left">TOTAL</td>
                    <td className="px-2 border text-right">₱{Number(buildRows().reduce((sum, r) => sum + Number(r.systemBalance || 0), 0)).toLocaleString()}</td>
                    <td className="px-2 border text-right">₱{Number(buildRows().reduce((sum, r) => sum + Number(r.cashOnHand || 0), 0)).toLocaleString()}</td>
                    <td className="px-2 border text-right text-red-400">₱{Number(buildRows().reduce((sum, r) => sum + Number(r.short || 0), 0)).toLocaleString()}</td>
                    <td className="px-2 border text-right text-green-400">₱{Number(buildRows().reduce((sum, r) => sum + Number(r.over || 0), 0)).toLocaleString()}</td>
                    {(userRole === "admin" || userRole === "super_admin") && <td className="px-2 border"></td>}
                    {(userRole === "admin" || userRole === "super_admin") && <td className="px-2 border"></td>}
                    <td className="px-2 border"></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div></div>

          <div className="md:col-span-2">
            <div className="border rounded">
              <div className={`${dark ? "bg-gray-700" : "bg-gray-200"} text-center font-semibold py-2`}>
                Denomination of actual cash on hand
              </div>
              <table className="w-full text-sm border-collapse denom-table">
                <thead>
                  <tr>
                    <th className="border py-2 px-3 text-left">Denomination</th>
                    <th className="border py-2 px-3 text-left">PCS</th>
                    <th className="border py-2 px-3 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "d1000", label: "₱1000", value: 1000 },
                    { key: "d500", label: "₱500", value: 500 },
                    { key: "d200", label: "₱200", value: 200 },
                    { key: "d100", label: "₱100", value: 100 },
                    { key: "d50", label: "₱50", value: 50 },
                    { key: "d20", label: "₱20", value: 20 },
                    { key: "coins", label: "Coins (₱10/₱5/₱1 total)", value: 1 },
                  ].map((d) => {
                    const pcs = denomCount(d.key);
                    const total = pcs * d.value;
                    return (
                      <tr key={d.key} className="h-10">
                        <td className="border px-3">{d.label}</td>
                        <td className="border px-3">{pcs}</td>
                        <td className="border px-3 text-right">₱{Number(total || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}

                  <tr className="font-semibold">
                    <td className="border px-3">TOTAL</td>
                    <td className="border px-3"></td>
                    <td className="border px-3 text-right">₱{Number(denomTotalValue()).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm">
          <p><strong>Total System Balance:</strong> ₱{Number(reportData?.totalSystemBalance || 0).toLocaleString()}</p>
          <p><strong>Total Over:</strong> ₱{Number(reportData?.totalOver || 0).toLocaleString()}</p>
          <p><strong>Total Short:</strong> ₱{Number(reportData?.totalShort || 0).toLocaleString()}</p>
        </div>

        <div className="flex justify-between mt-10 text-sm">
          <div className="w-1/2 text-center">
            <div className="border-t border-gray-500 w-2/3 mx-auto mb-1"></div>
            Supervisor's Signature
          </div>
          <div className="w-1/2 text-center">
            <div className="border-t border-gray-500 w-2/3 mx-auto mb-1"></div>
            Admin's Signature
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
