import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig.js';
import { RefreshCw, Link, Users, TrendingUp, AlertCircle } from 'lucide-react';

export default function TellerMappings() {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    fetchMappings();
  }, []);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${getApiUrl()}/api/reports/teller-mappings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.data.success) {
        setMappings(response.data.mappings);
      } else {
        setError('Failed to fetch teller mappings');
      }
    } catch (err) {
      console.error('Error fetching mappings:', err);
      setError(err.response?.data?.message || 'Failed to fetch teller mappings');
    } finally {
      setLoading(false);
    }
  };

  const syncBettingData = async () => {
    try {
      setSyncLoading(true);
      setError(null);

      const response = await axios.post(`${getApiUrl()}/api/reports/sync-betting-data`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.data.success) {
        setLastSync(new Date());
        await fetchMappings(); // Refresh the mappings
        alert(`✅ ${response.data.message}`);
      } else {
        setError('Failed to sync betting data');
      }
    } catch (err) {
      console.error('Error syncing betting data:', err);
      setError(err.response?.data?.message || 'Failed to sync betting data');
    } finally {
      setSyncLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-PH');
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'exact': return 'text-green-600 bg-green-100';
      case 'fuzzy': return 'text-yellow-600 bg-yellow-100';
      case 'manual': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Loading teller mappings...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error Loading Mappings</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
              <button
                onClick={fetchMappings}
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Link className="text-indigo-500" />
              Teller Mappings
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Linking RMI Reporting tellers with RMI Betting API data
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              🔄 Last synced: {lastSync ? formatDate(lastSync) : 'Never'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={syncBettingData}
              disabled={syncLoading}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncLoading ? 'animate-spin' : ''}`} />
              {syncLoading ? 'Syncing...' : 'Sync Betting Data'}
            </button>
            <button
              onClick={fetchMappings}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Mappings</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{mappings.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Bet Amount</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(mappings.reduce((sum, m) => sum + (m.bettingData?.lastBetAmount || 0), 0))}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <Link className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Links</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {mappings.filter(m => m.lastBettingSync).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Teller Mappings</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Reporting System
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Betting API
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Match Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Last Bet Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  System Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Last Sync
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {mappings.map((mapping) => (
                <tr key={mapping.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {mapping.tellerUsername}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {mapping.tellerName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {mapping.bettingUsername}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {mapping.bettingName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getConfidenceColor(mapping.matchConfidence)}`}>
                      {mapping.matchConfidence.toUpperCase()}
                    </span>
                    {mapping.matchReason && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {mapping.matchReason}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatCurrency(mapping.bettingData?.lastBetAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatCurrency(mapping.bettingData?.lastSystemBalance)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(mapping.bettingData?.lastSyncDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mappings.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No teller mappings found. Run the matching process to create mappings.
          </div>
        )}
      </div>
    </div>
  );
}