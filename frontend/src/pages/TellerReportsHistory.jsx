import React, { useEffect, useState, useContext, useMemo } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import { FileText, Calendar, TrendingUp, TrendingDown, DollarSign, Eye } from "lucide-react";

export default function TellerReportsHistory() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewReport, setViewReport] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Fetch reports on mount
  useEffect(() => {
    if (user?._id) {
      fetchReports();
    }
  }, [user?._id]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      
      const urlSuffix = params.toString() ? `?${params.toString()}` : "";
      const res = await axios.get(`${getApiUrl()}/api/teller-reports/teller/${user._id}${urlSuffix}`);
      setReports(res.data?.reports || []);
    } catch (err) {
      console.error("Error fetching reports:", err);
      showToast({ type: "error", message: "Failed to load reports" });
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary statistics
  const summary = useMemo(() => {
    return {
      totalReports: reports.length,
      totalOver: reports.reduce((sum, r) => sum + (r.over || 0), 0),
      totalShort: reports.reduce((sum, r) => sum + (r.short || 0), 0),
      avgSystemBalance: reports.length > 0 
        ? reports.reduce((sum, r) => sum + (r.systemBalance || 0), 0) / reports.length 
        : 0,
    };
  }, [reports]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  };

  const formatCurrency = (num) => {
    return `₱${(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className={`p-6 min-h-screen ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6" />
          My Report History
        </h1>
        <p className="text-sm opacity-70 mt-1">View your submitted teller reports</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-lg shadow ${dark ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-70">Total Reports</div>
              <div className="text-2xl font-bold">{summary.totalReports}</div>
            </div>
            <FileText className="w-8 h-8 opacity-50" />
          </div>
        </div>

        <div className={`p-4 rounded-lg shadow ${dark ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-70">Total Over</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(summary.totalOver)}
              </div>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className={`p-4 rounded-lg shadow ${dark ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-70">Total Short</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(summary.totalShort)}
              </div>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className={`p-4 rounded-lg shadow ${dark ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-70">Avg Balance</div>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.avgSystemBalance)}
              </div>
            </div>
            <DollarSign className="w-8 h-8 opacity-50" />
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className={`p-4 rounded-lg shadow mb-6 ${dark ? "bg-gray-800" : "bg-white"}`}>
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`w-full p-2 rounded border ${
                dark ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
              }`}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={`w-full p-2 rounded border ${
                dark ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
              }`}
            />
          </div>
          <button
            onClick={fetchReports}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Filter
          </button>
          {(fromDate || toDate) && (
            <button
              onClick={() => {
                setFromDate("");
                setToDate("");
                fetchReports();
              }}
              className={`px-4 py-2 rounded ${
                dark ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Reports Table */}
      <div className={`rounded-lg shadow overflow-hidden ${dark ? "bg-gray-800" : "bg-white"}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={`${dark ? "bg-gray-700" : "bg-gray-100"}`}>
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Supervisor</th>
                <th className="p-3 text-right">System Balance</th>
                <th className="p-3 text-right">Cash on Hand</th>
                <th className="p-3 text-right">Over</th>
                <th className="p-3 text-right">Short</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center opacity-70">
                    Loading reports...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center opacity-70">
                    No reports found for the selected period.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr
                    key={report._id}
                    className={`border-t ${
                      dark ? "border-gray-700 hover:bg-gray-750" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <td className="p-3">{formatDate(report.date || report.createdAt)}</td>
                    <td className="p-3">{report.supervisorName || "N/A"}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(report.systemBalance)}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(report.cashOnHand)}</td>
                    <td className="p-3 text-right text-green-600 dark:text-green-400 font-semibold">
                      {report.over > 0 ? formatCurrency(report.over) : "-"}
                    </td>
                    <td className="p-3 text-right text-red-600 dark:text-red-400 font-semibold">
                      {report.short > 0 ? formatCurrency(report.short) : "-"}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          report.isApproved
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100"
                            : report.isVerified
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100"
                        }`}
                      >
                        {report.isApproved ? "Approved" : report.isVerified ? "Verified" : "Pending"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setViewReport(report)}
                        className={`px-3 py-1 rounded text-xs flex items-center gap-1 mx-auto ${
                          dark
                            ? "bg-gray-700 hover:bg-gray-600 text-gray-100"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                        }`}
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Report Modal */}
      {viewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div
            className={`w-full max-w-2xl rounded-xl p-6 ${
              dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Report Details</h3>
              <button
                onClick={() => setViewReport(null)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Date & Supervisor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm opacity-70">Date</div>
                  <div className="font-semibold">{formatDate(viewReport.date || viewReport.createdAt)}</div>
                </div>
                <div>
                  <div className="text-sm opacity-70">Supervisor</div>
                  <div className="font-semibold">{viewReport.supervisorName || "N/A"}</div>
                </div>
              </div>

              {/* Balances */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm opacity-70">System Balance</div>
                  <div className="text-lg font-bold">{formatCurrency(viewReport.systemBalance)}</div>
                </div>
                <div>
                  <div className="text-sm opacity-70">Cash on Hand</div>
                  <div className="text-lg font-bold">{formatCurrency(viewReport.cashOnHand)}</div>
                </div>
              </div>

              {/* Over/Short */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm opacity-70">Over</div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(viewReport.over)}
                  </div>
                </div>
                <div>
                  <div className="text-sm opacity-70">Short</div>
                  <div className="text-lg font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(viewReport.short)}
                  </div>
                </div>
              </div>

              {/* Denominations */}
              <div>
                <div className="text-sm opacity-70 mb-2">Denominations</div>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className={`p-2 rounded ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                    <div className="opacity-70">₱1000</div>
                    <div className="font-semibold">{viewReport.d1000 || 0}</div>
                  </div>
                  <div className={`p-2 rounded ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                    <div className="opacity-70">₱500</div>
                    <div className="font-semibold">{viewReport.d500 || 0}</div>
                  </div>
                  <div className={`p-2 rounded ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                    <div className="opacity-70">₱200</div>
                    <div className="font-semibold">{viewReport.d200 || 0}</div>
                  </div>
                  <div className={`p-2 rounded ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                    <div className="opacity-70">₱100</div>
                    <div className="font-semibold">{viewReport.d100 || 0}</div>
                  </div>
                  <div className={`p-2 rounded ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                    <div className="opacity-70">₱50</div>
                    <div className="font-semibold">{viewReport.d50 || 0}</div>
                  </div>
                  <div className={`p-2 rounded ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                    <div className="opacity-70">₱20</div>
                    <div className="font-semibold">{viewReport.d20 || 0}</div>
                  </div>
                  <div className={`p-2 rounded ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                    <div className="opacity-70">Coins</div>
                    <div className="font-semibold">{formatCurrency(viewReport.coins)}</div>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <div className="text-sm opacity-70 mb-1">Status</div>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    viewReport.isApproved
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100"
                      : viewReport.isVerified
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100"
                  }`}
                >
                  {viewReport.isApproved ? "✓ Approved" : viewReport.isVerified ? "✓ Verified" : "⏳ Pending"}
                </span>
              </div>

              {/* Remarks */}
              {viewReport.remarks && (
                <div>
                  <div className="text-sm opacity-70 mb-1">Remarks</div>
                  <div className={`p-3 rounded ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                    {viewReport.remarks}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setViewReport(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
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
