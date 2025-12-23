import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig.js';
import { SettingsContext } from '../context/SettingsContext';
import { RefreshCw, BarChart3 } from 'lucide-react';

export default function SupervisorStaffPerformance() {
  const { settings, user } = useContext(SettingsContext);
  const dark = settings?.theme?.mode === "dark";
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    fetchStaffPerformanceData();

    // Auto-refresh every 3 minutes (180,000 milliseconds)
    const intervalId = setInterval(() => {
      fetchStaffPerformanceData();
    }, 180000);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const fetchStaffPerformanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = `${getApiUrl()}/api/reports/supervisor/staff-performance`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setReportData(response.data.data);
        setLastRefresh(new Date());
        
        // Check if there's a message about no data
        if (response.data.message) {
          setError(response.data.message);
        } else {
          setError(null);
        }
      } else {
        setError('Failed to fetch staff performance data');
      }
    } catch (err) {
      console.error('Error fetching staff performance data:', err);
      setError(err.response?.data?.message || 'Failed to fetch staff performance data');
    } finally {
      setLoading(false);
    }
  };

  // Get max bet amount for scaling bars
  const getMaxBetAmount = (staffReports) => {
    if (!staffReports || staffReports.length === 0) return 1;
    return Math.max(...staffReports.map(staff => staff.betAmount || 0));
  };

  // Calculate bar width percentage
  const getBarWidth = (betAmount, maxAmount) => {
    if (maxAmount === 0) return 0;
    return (betAmount / maxAmount) * 100;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Loading staff performance...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error Loading Performance Data</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
              <button
                onClick={fetchStaffPerformanceData}
                className="mt-3 bg-red-100 dark:bg-red-800 px-3 py-1 rounded text-sm text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData || !reportData.staffReports || reportData.staffReports.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No Staff Performance Data</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No betting event data available for your staff.</p>
        </div>
      </div>
    );
  }

  const { staffReports } = reportData;
  const maxBetAmount = getMaxBetAmount(staffReports);

  // Sort by bet amount (highest to lowest)
  const sortedStaff = [...staffReports].sort((a, b) => (b.betAmount || 0) - (a.betAmount || 0));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className={`rounded-lg shadow p-6 ${dark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📊 Staff Performance</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Betting Event Performance - Your Team</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              🔄 Auto-refresh every 3 minutes • Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={fetchStaffPerformanceData}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Performance Bars */}
      <div className={`rounded-lg shadow p-6 ${dark ? 'bg-gray-800' : 'bg-white'}`}>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Bet Amount Performance (Highest to Lowest)
        </h2>

        <div className="space-y-4">
          {sortedStaff.map((staff, index) => {
            const barWidth = getBarWidth(staff.betAmount || 0, maxBetAmount);

            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-orange-600 text-white' :
                      'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{staff.name}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">@{staff.username}</div>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className={`h-8 rounded-lg ${
                    index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                    index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                    index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                    'bg-gradient-to-r from-blue-400 to-blue-500'
                  }`} style={{ width: `${barWidth}%` }}>
                  </div>
                  <div className={`h-8 rounded-lg border-2 border-dashed absolute top-0 right-0 ${
                    dark ? 'border-gray-600' : 'border-gray-300'
                  }`} style={{ width: `${100 - barWidth}%`, left: `${barWidth}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className={`mt-8 p-4 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-50'}`}>
          <div className="grid grid-cols-1 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Staff</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{sortedStaff.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}