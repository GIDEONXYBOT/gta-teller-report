import React, { useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";

const PayrollCleanupTools = () => {
  const { settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const apiBaseUrl = getApiUrl();

  const [isLoading, setIsLoading] = useState(false);
  const [daysBack, setDaysBack] = useState(7);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState("duplicates"); // 'duplicates' or 'recalculate'

  const handleCleanupDuplicates = async () => {
    if (!window.confirm(`Delete duplicate payroll records from the past ${daysBack} days?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${apiBaseUrl}/api/payroll/cleanup/duplicates`, 
        { daysBack },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 200) {
        setResults({
          type: "duplicates",
          ...response.data,
          timestamp: new Date().toLocaleString()
        });
        showToast(`✅ Deleted ${response.data.totalDeleted} duplicate payroll records`, "success");
      }
    } catch (err) {
      console.error("❌ Error cleaning up duplicates:", err);
      showToast(`❌ Error: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecalculateWithFixedSalaries = async () => {
    if (!window.confirm(`Recalculate payroll with fixed salaries for the past ${daysBack} days?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${apiBaseUrl}/api/payroll/recalculate/with-fixed-salaries`, 
        { daysBack },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 200) {
        setResults({
          type: "recalculate",
          ...response.data,
          timestamp: new Date().toLocaleString()
        });
        showToast(`✅ Recalculated ${response.data.totalRecalculated} payroll records`, "success");
      }
    } catch (err) {
      console.error("❌ Error recalculating payrolls:", err);
      showToast(`❌ Error: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunBoth = async () => {
    if (!window.confirm(`Run both cleanup and recalculation for the past ${daysBack} days?\n\nThis will:\n1. Delete duplicate payroll records\n2. Recalculate all payroll with fixed salaries`)) {
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // First cleanup duplicates
      const cleanupResponse = await axios.post(`${apiBaseUrl}/api/payroll/cleanup/duplicates`, 
        { daysBack },
        { headers }
      );

      showToast(`✅ Deleted ${cleanupResponse.data.totalDeleted} duplicate records`, "success");

      // Then recalculate
      const recalcResponse = await axios.post(`${apiBaseUrl}/api/payroll/recalculate/with-fixed-salaries`, 
        { daysBack },
        { headers }
      );

      setResults({
        type: "both",
        cleanup: cleanupResponse.data,
        recalculate: recalcResponse.data,
        timestamp: new Date().toLocaleString()
      });

      showToast(`✅ Cleanup and recalculation complete!`, "success");
    } catch (err) {
      console.error("❌ Error running operations:", err);
      showToast(`❌ Error: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payroll Cleanup Tools</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {results && `Last run: ${results.timestamp}`}
        </p>
      </div>

      {/* Warning Alert */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Admin Only: These operations modify payroll data. Use with caution and verify results.
            </p>
          </div>
        </div>
      </div>

      {/* Days Back Input */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Days to Process
        </label>
        <input
          type="number"
          min="1"
          max="90"
          value={daysBack}
          onChange={(e) => setDaysBack(Math.max(1, Math.min(90, parseInt(e.target.value) || 1)))}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Process payroll records from the past {daysBack} day(s)
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("duplicates")}
          className={`px-4 py-2 font-medium transition ${
            activeTab === "duplicates"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
          }`}
        >
          Clean Duplicates
        </button>
        <button
          onClick={() => setActiveTab("recalculate")}
          className={`px-4 py-2 font-medium transition ${
            activeTab === "recalculate"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
          }`}
        >
          Recalculate Salaries
        </button>
        <button
          onClick={() => setActiveTab("both")}
          className={`px-4 py-2 font-medium transition ${
            activeTab === "both"
              ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
          }`}
        >
          Run Both
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "duplicates" && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Clean Duplicate Payroll Records</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This will identify and delete duplicate payroll records where the same teller has multiple entries for the same day. The newest record will be kept.
          </p>
          <button
            onClick={handleCleanupDuplicates}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition"
          >
            {isLoading ? "Processing..." : "Delete Duplicates"}
          </button>
        </div>
      )}

      {activeTab === "recalculate" && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Recalculate Payroll with Fixed Salaries</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This will recalculate all payroll records using the current base salary values. Useful when salaries have been fixed but old records still show old values.
          </p>
          <button
            onClick={handleRecalculateWithFixedSalaries}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition"
          >
            {isLoading ? "Processing..." : "Recalculate Now"}
          </button>
        </div>
      )}

      {activeTab === "both" && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Run Both Operations</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This will run both operations in sequence:
          </p>
          <ol className="list-decimal list-inside text-gray-600 dark:text-gray-400 mb-6 space-y-2">
            <li>Delete duplicate payroll records</li>
            <li>Recalculate all payroll with fixed salaries</li>
          </ol>
          <button
            onClick={handleRunBoth}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition"
          >
            {isLoading ? "Processing..." : "Run Both Operations"}
          </button>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Results</h3>

          {results.type === "duplicates" && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-700">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  ✅ {results.message}
                </p>
              </div>
              {results.details && results.details.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Date</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Deleted Amount</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Kept Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {results.details.slice(0, 10).map((detail, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-300">{detail.date}</td>
                          <td className="px-4 py-2 text-red-600 dark:text-red-400">₱{detail.deletedAmount?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-green-600 dark:text-green-400">₱{detail.keptAmount?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {results.details.length > 10 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      ... and {results.details.length - 10} more records
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {results.type === "recalculate" && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-700">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  ✅ {results.message}
                </p>
              </div>
              {results.details && results.details.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Old Base</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-white">New Base</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Old Total</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-white">New Total</th>
                        <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {results.details.slice(0, 10).map((detail, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-300">₱{detail.oldBaseSalary?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-300">₱{detail.newBaseSalary?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-300">₱{detail.oldTotalSalary?.toFixed(2)}</td>
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-300">₱{detail.newTotalSalary?.toFixed(2)}</td>
                          <td className={`px-4 py-2 font-medium ${detail.difference >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {detail.difference >= 0 ? "+" : ""}₱{detail.difference?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {results.details.length > 10 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      ... and {results.details.length - 10} more records
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {results.type === "both" && (
            <div className="space-y-6">
              {/* Cleanup Results */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Step 1: Cleanup</h4>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-700">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    ✅ {results.cleanup.message}
                  </p>
                </div>
              </div>

              {/* Recalculate Results */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Step 2: Recalculation</h4>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-700">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    ✅ {results.recalculate.message}
                  </p>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200 dark:border-green-700">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  ✅ All operations completed successfully!
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PayrollCleanupTools;
