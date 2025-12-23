// DEPRECATED: archived from src/pages/AdminSupervisorReport.jsx on 2025-11-14
import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

export default function AdminSupervisorReport() {
  const { settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [supervisors, setSupervisors] = useState([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef();

  // top-level summary across all supervisors
  const [summary, setSummary] = useState({
    totalSupervisors: 0,
    totalSystemBalance: 0,
    totalOver: 0,
    totalShort: 0,
  });

  useEffect(() => {
    const handler = () => {
      if (selectedSupervisor) fetchSupervisorReport(selectedSupervisor);
      fetchSupervisors();
      fetchSummary();
    };

    const socket = getGlobalSocket();
    if (socket) {
      socket.on("supervisorReportUpdated", handler);
      socket.on("supervisorReportSubmitted", handler);
      socket.on("tellerManagementUpdated", handler);
      socket.on("transactionUpdated", handler);

      return () => {
        socket.off("supervisorReportUpdated", handler);
        socket.off("supervisorReportSubmitted", handler);
        socket.off("tellerManagementUpdated", handler);
        socket.off("transactionUpdated", handler);
      };
    }

    fetchSupervisors();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSupervisor]);

  /* fetch supervisors list */
  async function fetchSupervisors() {
    try {
      const res = await axios.get(`${getApiUrl()}/api/reports/supervisors/list`);
      setSupervisors(res.data || []);
    } catch (err) {
      console.error("❌ Failed to load supervisors:", err);
      showToast({ type: "error", message: "Failed to load supervisors" });
    }
  }

  /* fetch a specific supervisor's report */
  async function fetchSupervisorReport(supervisorId) {
    if (!supervisorId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${getApiUrl()}/api/reports/supervisor/${supervisorId}`);
      const computed = computeTotals(res.data);
      setReport(computed);
    } catch (err) {
      console.error("❌ Failed to fetch report:", err);
      showToast({ type: "error", message: "Failed to fetch report" });
    } finally {
      setLoading(false);
    }
  }

  /* fetch global summary across all supervisors */
  async function fetchSummary() {
    try {
      // Use backend aggregation if available; otherwise fetch all supervisors and sum
      const res = await axios.get(`${getApiUrl()}/api/reports/supervisors/list`);
      const supList = res.data || [];
      let totalSystemBalance = 0;
      let totalOver = 0;
      let totalShort = 0;

      // For accuracy we will fetch each supervisor's report (could be optimized server-side)
      await Promise.all(
        supList.map(async (s) => {
          try {
            const r = await axios.get(`${getApiUrl()}/api/reports/supervisor/${s._id}`);
            const data = r.data || {};
            totalSystemBalance += Number(data.totalSystemBalance || 0);
            totalOver += Number(data.totalOver || 0);
            totalShort += Number(data.totalShort || 0);
          } catch (e) {
            // ignore per-supervisor errors, continue aggregation
          }
        })
      );

      setSummary({
        totalSupervisors: supList.length,
        totalSystemBalance,
        totalOver,
        totalShort,
      });
    } catch (err) {
      console.error("Failed to load summary", err);
    }
  }

  function computeTotals(data) {
    if (!data || !data.tellers) return data;

    let totalShort = 0;
    let totalOver = 0;
    let totalSystemBalance = 0;

    data.tellers.forEach((t) => {
      totalShort += Number(t.short || 0);
      totalOver += Number(t.over || 0);
      totalSystemBalance += Number(t.systemBalance || 0);
    });

    return {
      ...data,
      totalShort,
      totalOver,
      totalSystemBalance,
    };
  }

  function handlePrint() {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head>
          <title>Admin Supervisor Report</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 20px; }
            h2 { text-align: center; margin: 6px 0; font-size: 16px; }
            table { width:100%; border-collapse: collapse; margin-top: 8px; font-size:12px;}
            th, td { border:1px solid #000; padding:6px; text-align:center; vertical-align: middle; }
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

  return (
    <div className={`p-6 min-h-screen ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Admin Supervisor Report</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchSupervisors();
              if (selectedSupervisor) fetchSupervisorReport(selectedSupervisor);
              fetchSummary();
            }}
            className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Refresh
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white"
          >
            Print Report
          </button>
        </div>
      </div>

      {/* Summary header across all supervisors */}
      <div className={`mb-4 rounded p-3 ${dark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="p-2 rounded border bg-indigo-50">
            <div className="text-xs text-gray-600">Total Supervisors</div>
            <div className="font-semibold text-lg">{summary.totalSupervisors}</div>
          </div>
          <div className="p-2 rounded border bg-blue-50">
            <div className="text-xs text-gray-600">Total System Balance</div>
            <div className="font-semibold text-lg">₱{Number(summary.totalSystemBalance || 0).toLocaleString()}</div>
          </div>
          <div className="p-2 rounded border bg-red-50">
            <div className="text-xs text-gray-600">Total Short</div>
            <div className="font-semibold text-lg text-red-600">₱{Number(summary.totalShort || 0).toLocaleString()}</div>
          </div>
          <div className="p-2 rounded border bg-green-50">
            <div className="text-xs text-gray-600">Total Over</div>
            <div className="font-semibold text-lg text-green-600">₱{Number(summary.totalOver || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-medium">Select Supervisor</label>
        <select
          className={`p-2 rounded border ${dark ? "bg-gray-800 border-gray-600 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
          value={selectedSupervisor}
          onChange={(e) => {
            setSelectedSupervisor(e.target.value);
            fetchSupervisorReport(e.target.value);
          }}
        >
          <option value="">-- Choose Supervisor --</option>
          {supervisors.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name || s.username} {s.submitted ? "✓ Submitted" : "⏳ Pending"}
            </option>
          ))}
        </select>

        {/* Submission Status Summary */}
        <div className="mt-2 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle2 size={16} />
            <span>{supervisors.filter(s => s.submitted).length} Submitted</span>
          </div>
          <div className="flex items-center gap-1 text-amber-600">
            <Clock size={16} />
            <span>{supervisors.filter(s => !s.submitted).length} Pending</span>
          </div>
        </div>
      </div>

      <div ref={printRef} className={`rounded-lg shadow-lg border ${dark ? "border-gray-700 bg-gray-800" : "border-gray-300 bg-white"} p-4`}>
        {loading ? (
          <div className="text-center py-20">Loading...</div>
        ) : !report ? (
          <div className="text-center py-10 text-gray-500">Select a supervisor to view report</div>
        ) : (
          <>
            <div className="flex justify-between items-start text-sm mb-3">
              <div>
                <strong>Supervisor:</strong> {report.supervisorName}
                {supervisors.find(s => s._id === selectedSupervisor)?.submitted && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    <CheckCircle2 size={12} />
                    Submitted
                  </span>
                )}
              </div>
              <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
            </div>

            <h2 className="text-center font-bold mb-3">SUPERVISOR’S REPORT (ADMIN VIEW)</h2>

            <table className="w-full border-collapse text-sm">
              <thead className={dark ? "bg-gray-700" : "bg-gray-200"}>
                <tr>
                  <th className="border px-2 py-1">TELLER</th>
                  <th className="border px-2 py-1">SYSTEM BALANCE</th>
                  <th className="border px-2 py-1">CASH ON HAND</th>
                  <th className="border px-2 py-1 text-red-400">SHORT</th>
                  <th className="border px-2 py-1 text-green-400">OVER</th>
                </tr>
              </thead>
              <tbody>
                {report.tellers?.map((t) => (
                  <tr key={t.tellerId}>
                    <td className="border px-2 py-1 text-left">{t.tellerName}</td>
                    <td className="border px-2 py-1 text-right">₱{Number(t.systemBalance || 0).toLocaleString()}</td>
                    <td className="border px-2 py-1 text-right">₱{Number(t.cashOnHand || 0).toLocaleString()}</td>
                    <td className="border px-2 py-1 text-right text-red-400">₱{Number(t.short || 0).toLocaleString()}</td>
                    <td className="border px-2 py-1 text-right text-green-400">₱{Number(t.over || 0).toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="font-semibold bg-gray-100 dark:bg-gray-700">
                  <td className="border px-2 py-1 text-left">TOTAL</td>
                  <td className="border px-2 py-1 text-right">₱{Number(report.tellers?.reduce((sum, t) => sum + Number(t.systemBalance || 0), 0) || 0).toLocaleString()}</td>
                  <td className="border px-2 py-1 text-right">₱{Number(report.tellers?.reduce((sum, t) => sum + Number(t.cashOnHand || 0), 0) || 0).toLocaleString()}</td>
                  <td className="border px-2 py-1 text-right text-red-400">₱{Number(report.tellers?.reduce((sum, t) => sum + Number(t.short || 0), 0) || 0).toLocaleString()}</td>
                  <td className="border px-2 py-1 text-right text-green-400">₱{Number(report.tellers?.reduce((sum, t) => sum + Number(t.over || 0), 0) || 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-4 border-t pt-2 text-sm space-y-1">
              <p><strong>Total System Balance:</strong> ₱{Number(report?.totalSystemBalance || 0).toLocaleString()}</p>
              <p><strong>Total Short:</strong> ₱{Number(report?.totalShort || 0).toLocaleString()}</p>
              <p><strong>Total Over:</strong> ₱{Number(report?.totalOver || 0).toLocaleString()}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
