import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig.js';
import { RefreshCw } from 'lucide-react';

export default function BettingEventReport() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [sortBy, setSortBy] = useState('betAmount'); // 'betAmount' or 'systemBalance'
  
  // Get current user role
  const getCurrentUserRole = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.role || 'supervisor';
    } catch {
      return 'supervisor';
    }
  };
  const userRole = getCurrentUserRole();
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isSupervisor = userRole === 'supervisor';
  const isTeller = userRole === 'teller';
  const canViewReport = isAdmin || isSupervisor || isTeller;

  useEffect(() => {
    fetchBettingEventData();
    
    // Auto-refresh every 3 minutes (180,000 milliseconds)
    const intervalId = setInterval(() => {
      fetchBettingEventData();
    }, 180000);
    
    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const fetchBettingEventData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setLoading(false);
        return;
      }

      const url = `${getApiUrl()}/api/reports/betting-event`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setReportData({
          data: response.data.data.data || response.data.data,
          filtered: response.data.data.filtered,
          dateRange: response.data.data.dateRange
        });
        setLastRefresh(new Date());
      } else {
        setError('Failed to fetch betting event data');
      }
    } catch (err) {
      console.error('Error fetching betting event data:', err);
      const errorMessage = err.response?.data?.message || err.response?.status === 401 
        ? 'Unauthorized - Please log in again' 
        : err.response?.status === 403
        ? 'Forbidden - You do not have permission to access this report'
        : err.message || 'Failed to fetch betting event data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not completed';
    return new Date(dateString).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Sort staff reports based on selected criteria
  const sortStaffReports = (staffReports, sortBy) => {
    return [...staffReports].sort((a, b) => {
      if (sortBy === 'betAmount') {
        return (b.betAmount || 0) - (a.betAmount || 0);
      } else if (sortBy === 'systemBalance') {
        return (b.systemBalance || 0) - (a.systemBalance || 0);
      }
      return 0;
    });
  };

  // Calculate commission as 5.5% of bet amount
  const calculateCommission = (betAmount) => {
    return (betAmount || 0) * 0.055;
  };

  // Convert bet amount to points (1500 PHP = 1 point)
  const convertToPoints = (betAmount) => {
    return ((betAmount || 0) / 1500).toFixed(2);
  };

  const ordinalSuffixOf = (i) => {
    const n = i;
    if (!n) return '';
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    switch (n % 10) {
      case 1: return `${n}st`;
      case 2: return `${n}nd`;
      case 3: return `${n}rd`;
      default: return `${n}th`;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Loading betting event report...</span>
        </div>
      </div>
    );
  }

  if (error) {
    // Special message for tellers without mapping
    const isNoMappingError = error.includes('no betting API mapping') || (reportData?.isTellerData && (!reportData?.data?.staffReports || reportData.data.staffReports.length === 0));
    
    return (
      <div className="p-6">
        <div className={`${isNoMappingError ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'} rounded-lg p-4`}>
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className={`h-5 w-5 ${isNoMappingError ? 'text-yellow-400' : 'text-red-400'}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${isNoMappingError ? 'text-yellow-800 dark:text-yellow-200' : 'text-red-800 dark:text-red-200'}`}>
                {isNoMappingError ? 'Not Mapped to Betting System' : 'Error Loading Report'}
              </h3>
              <div className={`mt-2 text-sm ${isNoMappingError ? 'text-yellow-700 dark:text-yellow-300' : 'text-red-700 dark:text-red-300'}`}>
                {isNoMappingError ? (
                  <>
                    <p>Your account is not yet mapped to the betting system.</p>
                    <p className="mt-1">Please contact your supervisor or administrator to set up your betting account mapping.</p>
                  </>
                ) : (
                  error
                )}
              </div>
              <button
                onClick={fetchBettingEventData}
                className={`mt-3 ${isNoMappingError ? 'bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-700' : 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700'} px-3 py-1 rounded text-sm`}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">No betting event data available</div>
      </div>
    );
  }

  const { data } = reportData;

  // Check if teller has no data (not mapped)
  if (isTeller && (!data?.staffReports || data.staffReports.length === 0)) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="text-center">
            <svg className="h-12 w-12 text-yellow-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200 mb-2">Not Mapped to Betting System</h3>
            <p className="text-yellow-700 dark:text-yellow-300">
              Your account hasn't been set up in the betting system yet.
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
              Please contact your supervisor or administrator to set up your betting account mapping.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🎯 Betting Event Report</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">{data.title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              🔄 Auto-refresh every 3 minutes • Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={fetchBettingEventData}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Created:</span>
            <p className="font-medium">{formatDateTime(data.createdAt)}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Completed:</span>
            <p className="font-medium">{formatDateTime(data.completedAt)}</p>
          </div>
        </div>
      </div>

      {/* Financial Summary - Admin/SuperAdmin Only */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">💰 Financial Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="text-sm text-green-600 dark:text-green-400 font-medium">Total Starting Balance</div>     
              <div className="text-2xl font-bold text-green-800 dark:text-green-200">{formatCurrency(data.totalStartingBalance)}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total System Balance</div>
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">{formatCurrency(data.totalSystemBalance)}</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Total Bet Amount</div>
              <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">{formatCurrency(data.totalBetAmount)}</div>
            </div>
            <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg">
              <div className="text-sm text-pink-600 dark:text-pink-400 font-medium">Total Commission (5.5%)</div>      
              <div className="text-2xl font-bold text-pink-800 dark:text-pink-200">
                {formatCurrency((data.staffReports || []).reduce((sum, staff) => sum + calculateCommission(staff.betAmount), 0))}
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <div className="text-sm text-red-600 dark:text-red-400 font-medium">Total Payout</div>
              <div className="text-2xl font-bold text-red-800 dark:text-red-200">{formatCurrency(data.totalPayout)}</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <div className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Total Canceled/Returned</div>  
              <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">{formatCurrency(data.totalCanceledBet)}</div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
              <div className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">Net Profit</div>
              <div className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">
                {formatCurrency(data.totalBetAmount - data.totalPayout - data.totalCanceledBet)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff Reports */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">👥 Staff Performance</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="betAmount">Bet Amount</option>
                <option value="systemBalance">System Balance</option>
              </select>
            </div>
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              📊 Sorted by {sortBy === 'betAmount' ? 'Bet Amount' : 'System Balance'} (Highest to Lowest)
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Teller</th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Starting Balance</th>
                )}
                {!isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Points</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Bet Amount</th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Payout</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">System Balance</th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Commission</th>
                )}
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Profit/Loss</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortStaffReports(data.staffReports || [], sortBy).map((staff, index) => {
                const profit = (staff.betAmount || 0) - (staff.payout || 0) - (staff.canceledBet || 0);
                const commission = calculateCommission(staff.betAmount);
                return (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200 font-semibold">
                      {ordinalSuffixOf(index + 1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{staff.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{staff.username}</div>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatCurrency(staff.startingBalance)}
                      </td>
                    )}
                    {!isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        {convertToPoints(staff.betAmount).toLocaleString()} pts
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatCurrency(staff.betAmount)}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatCurrency(staff.payout)}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatCurrency(staff.systemBalance)}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 dark:text-purple-400 font-medium">
                        {formatCurrency(commission)}
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}