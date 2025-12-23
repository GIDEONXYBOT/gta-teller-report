import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, History } from "lucide-react";
import UsersWithoutBaseSalary from "./UsersWithoutBaseSalary";
import PayrollCleanupTools from "./PayrollCleanupTools";

export default function PayrollBaseSalaryFixer() {
  const { settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [loading, setLoading] = useState(true);
  const [fetchingEmployees, setFetchingEmployees] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reason, setReason] = useState("");
  const [targetEmployees, setTargetEmployees] = useState([]);
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);
  const [historicalReason, setHistoricalReason] = useState("");

  // Fetch employees with zero base salary
  const fetchEmployeesWithZeroSalary = async () => {
    setFetchingEmployees(true);
    try {
      const API_BASE = getApiUrl();
      const res = await axios.get(`${API_BASE}/api/admin/employees-with-zero-salary`);
      
      if (res.data.success && res.data.employees.length > 0) {
        setTargetEmployees(res.data.employees);
      } else {
        setTargetEmployees([]);
        showToast({
          type: "info",
          message: "✅ No employees with zero base salary found!"
        });
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
      showToast({
        type: "error",
        message: "Failed to load employees"
      });
      setTargetEmployees([]);
    } finally {
      setFetchingEmployees(false);
    }
  };

  useEffect(() => {
    fetchEmployeesWithZeroSalary();
    setLoading(false);
  }, []);

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      const API_BASE = getApiUrl();
      const res = await axios.get(`${API_BASE}/api/admin/payroll-audit-logs`, {
        params: { limit: 10, sort: -1 }
      });
      setAuditLogs(res.data || []);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    }
  };

  useEffect(() => {
    if (showAuditLog) {
      fetchAuditLogs();
    }
  }, [showAuditLog]);

  // Execute the fix
  const handleFixPayroll = async () => {
    if (!reason.trim()) {
      showToast({
        type: "warning",
        message: "Please provide a reason for this update."
      });
      return;
    }

    if (targetEmployees.length === 0) {
      showToast({
        type: "warning",
        message: "No employees to update."
      });
      return;
    }

    setLoading(true);

    try {
      const API_BASE = getApiUrl();

      // Build conditional salaries based on employee roles
      const conditionalSalaries = {};
      for (const emp of targetEmployees) {
        const salary = emp.role === 'supervisor' ? 600 : 450;
        conditionalSalaries[emp.name] = salary;
      }

      const response = await axios.post(
        `${API_BASE}/api/admin/fix-payroll-base-salaries`,
        {
          targetNames: targetEmployees.map(e => e.name),
          baseSalary: 450,
          conditionalSalaries,
          reason
        }
      );

      const data = response.data;

      if (data.success) {
        showToast({
          type: "success",
          message: `✅ ${data.message}`
        });

        if (data.notificationSent) {
          showToast({
            type: "info",
            message: "📧 Notifications sent to admin"
          });
        }

        setReason("");
        setShowModal(false);
        
        // Refresh the list and audit logs
        setTimeout(() => {
          fetchEmployeesWithZeroSalary();
          fetchAuditLogs();
        }, 1000);
      } else {
        showToast({
          type: "error",
          message: data.message || "Update failed"
        });
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      showToast({
        type: "error",
        message: `❌ ${errorMsg}`
      });
    } finally {
      setLoading(false);
    }
  };

  // Fix ALL historical payroll records
  const handleFixAllHistorical = async () => {
    if (!historicalReason.trim()) {
      showToast({
        type: "warning",
        message: "Please provide a reason for this batch update."
      });
      return;
    }

    setLoading(true);

    try {
      const API_BASE = getApiUrl();

      const response = await axios.post(
        `${API_BASE}/api/admin/fix-all-historical-payroll`,
        {
          reason: historicalReason
        }
      );

      const data = response.data;

      if (data.success) {
        showToast({
          type: "success",
          message: `✅ ${data.message}`
        });

        if (data.updated > 0) {
          showToast({
            type: "info",
            message: `Fixed ${data.updated} historical payroll records`
          });
        }

        if (data.notificationSent) {
          showToast({
            type: "info",
            message: "📧 Notifications sent to admin"
          });
        }

        setHistoricalReason("");
        setShowHistoricalModal(false);
        
        // Refresh audit logs
        setTimeout(() => fetchAuditLogs(), 1000);
      } else {
        showToast({
          type: "error",
          message: data.message || "Update failed"
        });
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      showToast({
        type: "error",
        message: `❌ ${errorMsg}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-6 rounded-lg ${dark ? "bg-gray-800" : "bg-white"}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <RefreshCw size={24} />
          Payroll Base Salary Manager
        </h2>
        <button
          onClick={() => setShowAuditLog(!showAuditLog)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <History size={18} />
          Audit Log
        </button>
      </div>

      {/* Loading State */}
      {fetchingEmployees && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <span className="ml-3">Loading employees...</span>
        </div>
      )}

      {/* Empty State */}
      {!fetchingEmployees && targetEmployees.length === 0 && (
        <div className={`p-6 rounded-lg border-l-4 border-green-500 mb-6 ${
          dark ? "bg-green-900/20" : "bg-green-50"
        }`}>
          <div className="flex gap-3">
            <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-green-800">All Set!</p>
              <p className="text-sm text-green-700">
                ✅ No employees with zero base salary found. All payroll records have proper base salaries.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Employee List */}
      {!fetchingEmployees && targetEmployees.length > 0 && (
        <>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Employees with ₱0 Base Salary ({targetEmployees.length}):</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {targetEmployees.map((emp, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    dark
                      ? "bg-gray-700 border-gray-600"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold capitalize">{emp.name}</p>
                      <p className="text-sm text-gray-500">{emp.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-green-600">
                        ₱{emp.baseSalary || '0'}
                      </p>
                      <p className="text-xs text-gray-500">Current Base</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className={`p-4 rounded-lg border-l-4 border-yellow-500 mb-6 ${
            dark ? "bg-yellow-900/20" : "bg-yellow-50"
          }`}>
            <div className="flex gap-3">
              <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-yellow-800">Important:</p>
                <p className="text-sm text-yellow-700">
                  This will update payroll records with ₱0 base salary to the correct amounts based on employee role.
                  An audit log will be created and notifications will be sent to administrators.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowModal(true)}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Fix New Employees
                </>
              )}
            </button>
            
            <button
              onClick={() => setShowHistoricalModal(true)}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  Fix All Historical
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Info Box (when no employees) - already shown above */}
      {targetEmployees.length > 0 && (
        <div className="hidden" />
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`rounded-lg p-6 w-full max-w-md ${
              dark ? "bg-gray-900" : "bg-white"
            }`}
          >
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="text-orange-500" />
              Confirm Update
            </h3>

            <p className="mb-4 text-gray-600 dark:text-gray-400">
              You're about to update base salaries for {targetEmployees.length} employees.
              This action will be logged and audited.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">
                Reason for Update:
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Enter reason for this update (required)..."
                className={`w-full p-3 rounded border ${
                  dark
                    ? "bg-gray-800 border-gray-600 text-white"
                    : "bg-white border-gray-300"
                }`}
                rows={3}
              />
              {!reason.trim() && (
                <p className="text-sm text-red-500 mt-1">
                  ⚠️ Reason is required
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setReason("");
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded border border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFixPayroll}
                disabled={loading || !reason.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historical Payroll Fix Modal */}
      {showHistoricalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={`rounded-lg p-6 w-full max-w-md ${
              dark ? "bg-gray-900" : "bg-white"
            }`}
          >
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="text-red-500" />
              Fix All Historical Payroll
            </h3>

            <p className="text-sm mb-4 leading-relaxed">
              This will fix <strong>ALL historical payroll records</strong> with ₱0 base salary,
              automatically assigning the correct salary based on each employee's role:
            </p>

            <ul className="text-sm mb-4 space-y-1 ml-4 list-disc">
              <li>Tellers: ₱450</li>
              <li>Supervisors: ₱600</li>
              <li>Watchers: ₱400-450</li>
              <li>Admins: ₱0</li>
            </ul>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">
                Reason for Update:
              </label>
              <textarea
                value={historicalReason}
                onChange={(e) => setHistoricalReason(e.target.value)}
                placeholder="e.g., Bulk fix for historical payroll records created before salary sync..."
                className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${
                  dark
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-gray-50 border-gray-300"
                }`}
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowHistoricalModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg transition ${
                  dark
                    ? "bg-gray-700 hover:bg-gray-600"
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleFixAllHistorical}
                disabled={loading || !historicalReason.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? "Processing..." : "Confirm & Fix All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Section */}
      {showAuditLog && (
        <div className="mt-8 pt-8 border-t">
          <h3 className="text-lg font-bold mb-4">Update History (Audit Log)</h3>

          {auditLogs.length === 0 ? (
            <p className="text-gray-500">No audit logs found.</p>
          ) : (
            <div className="space-y-4">
              {auditLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    dark
                      ? "bg-gray-700 border-gray-600"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{log.actionType}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        By: {log.performedBy?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                      {log.reason && (
                        <p className="text-sm mt-2 italic">
                          Reason: {log.reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          log.status === "SUCCESS"
                            ? "text-green-600"
                            : log.status === "PARTIAL"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {log.status}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {log.payrollsUpdated} records
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Users Without Base Salary Component */}
      <div className="mt-8 border-t pt-6">
        <UsersWithoutBaseSalary />
      </div>

      {/* Payroll Cleanup Tools */}
      <div className="mt-8 border-t pt-6">
        <PayrollCleanupTools />
      </div>
    </div>
  );
}
