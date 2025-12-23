import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext';
import { getApiUrl } from '../utils/apiConfig';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Award,
  Activity,
  RefreshCw,
  Calendar,
  Filter,
  BarChart3,
  Percent
} from 'lucide-react';

export default function KeyPerformanceIndicator() {
  const { user, settings } = useContext(SettingsContext);
  const dark = settings?.theme?.mode === "dark";

  const [kpiData, setKpiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilter, setDateFilter] = useState({
    enabled: false,
    selectedDate: '',
    showAll: false
  });
  const [showTop5Only, setShowTop5Only] = useState(false);

  useEffect(() => {
    fetchKPIData();
  }, [dateFilter]);

  const fetchKPIData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters for date filtering
      const params = new URLSearchParams();
      if (dateFilter.enabled && dateFilter.selectedDate) {
        params.append('date', dateFilter.selectedDate);
      }
      if (dateFilter.showAll) {
        params.append('showAll', 'true');
      }

      const queryString = params.toString();
      const url = `${getApiUrl()}/api/reports/kpi/tellers${queryString ? `?${queryString}` : ''}`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setKpiData(response.data.data);
      } else {
        setError('Failed to fetch KPI data');
      }
    } catch (err) {
      console.error('Error fetching KPI data:', err);
      setError(err.response?.data?.message || 'Failed to fetch KPI data');
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

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-PH').format(num || 0);
  };

  const getPerformanceColor = (value, threshold) => {
    if (value >= threshold) return 'text-green-600 dark:text-green-400';
    if (value >= threshold * 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getPerformanceIcon = (value, threshold) => {
    if (value >= threshold) return <TrendingUp className="w-4 h-4" />;
    if (value >= threshold * 0.7) return <Activity className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Loading KPI data...</span>
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
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error Loading KPI Data</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
              <button
                onClick={fetchKPIData}
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📊 Key Performance Indicators</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Active Tellers Performance Dashboard - Based on Betting Event Report</p>
          </div>
          <div className="flex items-center gap-3">
            {user?.role === 'super_admin' && (
              <button
                onClick={() => setShowTop5Only(!showTop5Only)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  showTop5Only
                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                <Users size={16} />
                {showTop5Only ? "Top 5 Only" : "All Tellers"}
              </button>
            )}
            <button
              onClick={fetchKPIData}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">Date Filter</span>
          <div className="ml-auto flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dateFilter.showAll}
                onChange={(e) => setDateFilter(prev => ({
                  ...prev,
                  showAll: e.target.checked,
                  enabled: e.target.checked ? false : prev.enabled
                }))}
                className="rounded"
              />
              <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">Show All Historical</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dateFilter.enabled}
                onChange={(e) => setDateFilter(prev => ({
                  ...prev,
                  enabled: e.target.checked,
                  showAll: e.target.checked ? false : prev.showAll
                }))}
                className="rounded"
                disabled={dateFilter.showAll}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Enable Single Date</span>
            </label>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Select Date:</label>
            <input
              type="date"
              value={dateFilter.selectedDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, selectedDate: e.target.value }))}
              disabled={!dateFilter.enabled}
              className={`w-full p-2 border rounded ${
                dateFilter.enabled
                  ? 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white'
                  : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchKPIData}
              disabled={!dateFilter.enabled && !dateFilter.showAll}
              className={`w-full px-4 py-2 rounded flex items-center justify-center gap-2 ${
                (dateFilter.enabled || dateFilter.showAll)
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-gray-400 text-gray-200 cursor-not-allowed"
              }`}
            >
              <Filter className="w-4 h-4" />
              {dateFilter.showAll ? "Show All Data" : "Apply Date Filter"}
            </button>
          </div>
        </div>
      </div>

      {/* Status Banner for Data Source */}
      {kpiData?.source && (
        <div className={`border rounded-lg p-4 ${
          kpiData?.source === "real_betting_data"
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {kpiData?.source === "real_betting_data" ? (
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${
                kpiData?.source === "real_betting_data"
                  ? "text-green-800 dark:text-green-200"
                  : "text-yellow-800 dark:text-yellow-200"
              }`}>
                {kpiData?.source === "real_betting_data" ? "Real Teller Data" : "Demo Data Mode"}
              </h3>
              <div className={`mt-2 text-sm ${
                kpiData?.source === "real_betting_data"
                  ? "text-green-700 dark:text-green-300"
                  : "text-yellow-700 dark:text-yellow-300"
              }`}>
                {kpiData?.source === "real_betting_data"
                  ? `Showing ${kpiData.summary?.activeTellers || 0} real tellers from database reports`
                  : kpiData.scraperStatus || "Currently showing demo data. GTArena API requires authentication updates."
                }
              </div>
              {kpiData?.source === "real_betting_data" && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                  Data source: Teller Reports Database ({kpiData.summary?.activeTellers || 0} active tellers)
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {kpiData?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Tellers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpiData.summary.activeTellers}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">From betting activity</p>
              </div>
              <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Bet Amount</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(kpiData.summary.totalBetAmount)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">All active tellers</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Profit</p>
                <p className={`text-2xl font-bold ${kpiData.summary.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(kpiData.summary.totalProfit)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Net earnings</p>
              </div>
              <TrendingUp className={`w-8 h-8 ${kpiData.summary.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Bet/Teller</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(kpiData.summary.avgBetPerTeller)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Average per teller</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Commission</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(kpiData.summary.totalCommission)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Commission earnings</p>
              </div>
              <Target className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Top Performer</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{kpiData.summary.topPerformer?.name || 'N/A'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(kpiData.summary.topPerformer?.profit || 0)} profit</p>
              </div>
              <Award className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>
      )}

      {/* Teller Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(showTop5Only ? kpiData?.tellers?.slice(0, 5) : kpiData?.tellers)?.map((teller, index) => (
          <div key={teller._id || index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{teller.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">@{teller.username}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                    Rank #{teller.rank}
                  </span>
                  {showTop5Only && index < 5 && (
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                      🏆 Top Performer
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${teller.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(teller.profit)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Profit</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Bet Amount</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(teller.betAmount)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Payout</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(teller.payout)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Canceled/Returned</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(teller.canceledBet)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  Commission
                </span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(teller.commission)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Profit Margin</span>
                <span className={`font-semibold ${(teller.profitMargin || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {(teller.profitMargin || 0).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Efficiency</span>
                <span className={`font-semibold ${getPerformanceColor(teller.efficiency || 0, 10)}`}>
                  {(teller.efficiency || 0).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">System Balance</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(teller.systemBalance)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(!kpiData?.tellers || kpiData.tellers.length === 0) && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Tellers</h3>
          <p className="text-gray-600 dark:text-gray-400">No tellers with betting activity found in the betting event report for the selected period.</p>
        </div>
      )}
    </div>
  );
}