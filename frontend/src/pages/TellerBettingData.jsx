// frontend/src/pages/TellerBettingData.jsx
import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { getApiUrl } from '../utils/apiConfig.js';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function TellerBettingData() {
  const { user, settings } = useContext(SettingsContext);
  const API = getApiUrl();
  
  const [bettingData, setBettingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const isDark = settings?.theme?.mode === 'dark';
  const bg = isDark ? '#0f172a' : '#f8fafc';

  // Check if user has permission
  const canAccess = ['admin', 'super_admin'].includes(user?.role);

  // Fetch betting data
  const fetchBettingData = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      // Try to fetch from database first
      const response = await axios.get(`${API}/api/betting-data/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setBettingData(response.data.data || []);
        setLastFetch(new Date(response.data.lastFetch));
        setIsDemo(response.data.isDemo || false);
      }
    } catch (err) {
      // Fall back to external GTArena if database empty
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/api/external-betting/teller-bets`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          setBettingData(response.data.data || []);
          setLastFetch(new Date(response.data.lastFetch));
          setIsDemo(response.data.isDemo || false);
          if (response.data.message) {
            console.log(response.data.message);
          }
        }
      } catch (fallbackErr) {
        setError(fallbackErr.response?.data?.error || 'Failed to fetch betting data');
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Set GTArena credentials
  const handleSetCredentials = async () => {
    if (!credentials.username || !credentials.password) {
      setError('Username and password required');
      return;
    }
    
    setCredentialsLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/external-betting/set-credentials`, credentials, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowCredentialsModal(false);
      setError(null);
      setCredentials({ username: '', password: '' });
      // Auto-fetch after setting credentials
      setTimeout(fetchBettingData, 500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set credentials');
    } finally {
      setCredentialsLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) {
      fetchBettingData();
      // Auto-refresh every 5 minutes
      const interval = setInterval(fetchBettingData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [canAccess]);

  if (!canAccess) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600">Access denied. Only admins can view this page.</p>
      </div>
    );
  }

  const totalBetting = bettingData.reduce((sum, item) => sum + (item.totalBet || 0), 0);

  return (
    <div className="p-4 space-y-4" style={{ background: bg }}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">💰 Teller Betting Data</h1>
          {isDemo && (
            <span className="px-3 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">
              DEMO DATA
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchBettingData}
            disabled={refreshing}
            className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${
              refreshing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowCredentialsModal(true)}
            className="px-4 py-2 rounded text-sm font-medium bg-purple-600 text-white hover:bg-purple-700"
          >
            ⚙️ Credentials
          </button>
        </div>
      </div>

      {/* Error Box */}
      {error && (
        <div className={`p-4 rounded flex gap-2 ${isDark ? 'bg-red-900 text-red-100' : 'bg-red-50 text-red-800'}`}>
          <AlertCircle size={20} className="flex-shrink-0" />
          <div>
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Demo Data Info */}
      {isDemo && (
        <div className={`p-4 rounded flex gap-2 ${isDark ? 'bg-blue-900 text-blue-100' : 'bg-blue-50 text-blue-800'}`}>
          <AlertCircle size={20} className="flex-shrink-0" />
          <div>
            <p className="font-semibold">Showing Demo Data</p>
            <p className="text-sm">
              The GTArena website couldn't be accessed. This is demo data to show you how the system works.
              Real data will display once your GTArena credentials are verified.
              Check the server logs for details on why the connection failed.
            </p>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-4 rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <p className="text-sm text-gray-500">Total Betting</p>
          <p className="text-2xl font-bold">
            {new Intl.NumberFormat('en-PH', { 
              style: 'currency', 
              currency: 'PHP',
              minimumFractionDigits: 2 
            }).format(totalBetting)}
          </p>
        </div>
        
        <div className={`p-4 rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <p className="text-sm text-gray-500">Total Tellers</p>
          <p className="text-2xl font-bold">{bettingData.length}</p>
        </div>

        <div className={`p-4 rounded border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <p className="text-sm text-gray-500">Average Bet</p>
          <p className="text-2xl font-bold">
            {new Intl.NumberFormat('en-PH', { 
              style: 'currency', 
              currency: 'PHP',
              minimumFractionDigits: 2 
            }).format(bettingData.length > 0 ? totalBetting / bettingData.length : 0)}
          </p>
        </div>
      </div>

      {/* Last Fetch Info */}
      {lastFetch && (
        <p className="text-xs text-gray-500">Last updated: {new Date(lastFetch).toLocaleString()}</p>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">Loading betting data...</div>
      )}

      {/* Data Table */}
      {!loading && bettingData.length > 0 && (
        <div className={`rounded border overflow-x-auto ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <table className="w-full text-sm">
            <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Username</th>
                <th className="px-4 py-3 text-right font-semibold">Total Bet</th>
                <th className="px-4 py-3 text-right font-semibold">M/W Bet %</th>
                <th className="px-4 py-3 text-right font-semibold">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {bettingData
                .sort((a, b) => (b.totalBet || 0) - (a.totalBet || 0))
                .map((item, idx) => (
                  <tr 
                    key={idx} 
                    className={`border-t ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3">{item.username}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {new Intl.NumberFormat('en-PH', { 
                        style: 'currency', 
                        currency: 'PHP',
                        minimumFractionDigits: 2 
                      }).format(item.totalBet || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 font-semibold">
                      {(item.mwBetPercent || 0).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      {((((item.totalBet || 0) / totalBetting) * 100) || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && bettingData.length === 0 && !error && (
        <div className={`p-8 rounded text-center ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <p className="text-gray-500">No betting data available. Click "Refresh" to fetch data.</p>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`p-6 rounded max-w-md w-full ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-lg font-bold mb-4">GTArena Credentials</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                  placeholder="Enter GTArena username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  className={`w-full px-3 py-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                  placeholder="Enter GTArena password"
                />
              </div>
              <p className="text-xs text-gray-500">
                ℹ️ These credentials are stored securely on the server and used only to fetch betting data.
              </p>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowCredentialsModal(false)}
                className={`flex-1 px-4 py-2 rounded font-medium ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSetCredentials}
                disabled={credentialsLoading}
                className="flex-1 px-4 py-2 rounded font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {credentialsLoading ? 'Saving...' : 'Save & Fetch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
