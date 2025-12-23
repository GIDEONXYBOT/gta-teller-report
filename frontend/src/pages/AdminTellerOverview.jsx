import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { getApiUrl } from '../utils/apiConfig';
import { getGlobalSocket } from '../utils/globalSocket';
import { 
  Calendar, 
  Download, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Clock,
  RefreshCw,
  BarChart3
} from 'lucide-react';

export default function AdminTellerOverview() {
  const { settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [tellerData, setTellerData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalTellers: 0,
    totalBaseCapital: 0,
    totalAdditionalCapital: 0,
    totalCapitalDeployed: 0,
    totalRemittances: 0,
    totalBalance: 0,
    activeTellers: 0
  });
  
  // Fetch teller data for selected date
  const fetchTellerData = async (date = selectedDate) => {
    setLoading(true);
    try {
      const response = await axios.get(`${getApiUrl()}/api/admin/teller-overview`, {
        params: { date }
      });
      
      setTellerData(response.data.tellers || []);
      setSummary(response.data.summary || {});
      
    } catch (error) {
      console.error('Failed to fetch teller data:', error);
      showToast({ type: 'error', message: 'Failed to load teller data' });
    } finally {
      setLoading(false);
    }
  };

  // Trigger manual auto-assignment
  const triggerAutoAssignment = async () => {
    try {
      const response = await axios.post(`${getApiUrl()}/api/teller-management/auto-assign`);
      showToast({ 
        type: 'success', 
        message: `Auto-assignment completed! ${response.data.assignmentsCreated} assignments created.`
      });
      fetchTellerData(); // Refresh data
    } catch (error) {
      console.error('Auto-assignment failed:', error);
      showToast({ 
        type: 'error', 
        message: 'Failed to trigger auto-assignment'
      });
    }
  };

  // Export data to CSV
  const exportToCSV = () => {
    const headers = [
      'Teller Name',
      'Username',
      'Supervisor',
      'Base Capital',
      'Additional Capital',
      'Additional Count',
      'Total Capital Deployed',
      'Total Remittances',
      'Remittance Count', 
      'Balance',
      'Last Activity',
      'Status'
    ];

    const csvData = tellerData.map(teller => [
      teller.name,
      teller.username,
      teller.supervisor?.name || 'No Supervisor',
      teller.baseCapital || 0,
      teller.additionalCapital || 0,
      teller.additionalCount || 0,
      teller.totalCapitalDeployed || 0,
      teller.totalRemittances || 0,
      teller.remittanceCount || 0,
      teller.balance || 0,
      teller.lastActivity || 'No activity',
      teller.status || 'Unknown'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teller-overview-${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchTellerData();
  }, [selectedDate]);

  // Socket listeners for real-time updates
  useEffect(() => {
    const socket = getGlobalSocket();
    if (!socket) return;

    const handleTellerManagementUpdate = () => {
      console.log('🔄 Teller management updated - refreshing admin overview');
      fetchTellerData(selectedDate);
    };

    const handleTransactionUpdate = () => {
      console.log('💰 Transaction updated - refreshing admin overview'); 
      fetchTellerData(selectedDate);
    };

    // Listen for teller management updates
    socket.on('tellerManagementUpdated', handleTellerManagementUpdate);
    socket.on('transactionUpdated', handleTransactionUpdate);
    socket.on('capitalUpdated', handleTellerManagementUpdate);

    // Cleanup listeners on unmount
    return () => {
      socket.off('tellerManagementUpdated', handleTellerManagementUpdate);
      socket.off('transactionUpdated', handleTransactionUpdate); 
      socket.off('capitalUpdated', handleTellerManagementUpdate);
    };
  }, [selectedDate]);

  return (
    <div className={`p-6 min-h-screen ${dark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Teller Management Overview</h1>
          <p className="text-gray-500">Complete daily view of all teller activities</p>
        </div>
        
        {/* Date Filter & Export */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`pl-10 pr-4 py-2 rounded-lg border ${
                dark 
                  ? 'bg-gray-800 border-gray-600 text-gray-100' 
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          
          <button
            onClick={() => fetchTellerData()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={triggerAutoAssignment}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <BarChart3 className="w-4 h-4" />
            Auto-Assign
          </button>
          
          <button
            onClick={exportToCSV}
            disabled={!tellerData.length}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards - Separated Capital Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className={`p-4 rounded-xl ${dark ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">Total Users</p>
              <p className="text-xl font-bold">{summary.totalUsers}</p>
              <p className="text-xs text-gray-400">{summary.activeTellers} active</p>
            </div>
            <Users className="w-6 h-6 text-blue-500" />
          </div>
        </div>

        <div className={`p-4 rounded-xl ${dark ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">Base Capital</p>
              <p className="text-xl font-bold">₱{(summary.totalBaseCapital || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-400">Initial deployment</p>
            </div>
            <DollarSign className="w-6 h-6 text-green-500" />
          </div>
        </div>

        <div className={`p-4 rounded-xl ${dark ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">+ Additional</p>
              <p className="text-xl font-bold">₱{(summary.totalAdditionalCapital || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-400">{summary.totalAdditionalCount || 0} transactions</p>
            </div>
            <DollarSign className="w-6 h-6 text-emerald-500" />
          </div>
        </div>

        <div className={`p-4 rounded-xl ${dark ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">- Remittances</p>
              <p className="text-xl font-bold">₱{(summary.totalRemittances || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-400">{summary.totalRemittanceCount || 0} transactions</p>
            </div>
            <TrendingUp className="w-6 h-6 text-red-500" />
          </div>
        </div>

        <div className={`p-4 rounded-xl ${dark ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs font-medium">= Balance</p>
              <p className="text-xl font-bold">₱{(summary.totalBalance || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-400">Final calculation</p>
            </div>
            <BarChart3 className="w-6 h-6 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Teller Data Table */}
      <div className={`rounded-xl overflow-hidden shadow-sm border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">Teller Details - {selectedDate}</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Loading teller data...</p>
          </div>
        ) : tellerData.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">No teller data found for {selectedDate}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${dark ? 'bg-gray-750' : 'bg-gray-50'} border-b ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
                <tr>
                  <th className="text-left p-3 font-semibold text-sm">Teller & Supervisor</th>
                  <th className="text-left p-3 font-semibold text-sm">Base Capital</th>
                  <th className="text-left p-3 font-semibold text-sm">+ Additional</th>
                  <th className="text-left p-3 font-semibold text-sm">- Remittances</th>
                  <th className="text-left p-3 font-semibold text-sm">= Balance</th>
                  <th className="text-left p-3 font-semibold text-sm">Activity</th>
                  <th className="text-left p-3 font-semibold text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {tellerData.map((teller, index) => (
                  <tr 
                    key={teller._id || index}
                    className={`border-b ${dark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
                  >
                    <td className="p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{teller.name}</p>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            teller.role === 'supervisor' 
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          }`}>
                            {teller.role === 'supervisor' ? 'Supervisor' : 'Teller'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">@{teller.username}</p>
                        {teller.supervisor && teller.role === 'teller' && (
                          <p className="text-xs text-blue-500 mt-1">
                            Supervisor: {teller.supervisor.name}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">
                          ₱{(teller.baseCapital || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          Base deployment
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-emerald-600">
                          ₱{(teller.additionalCapital || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          ({teller.additionalCount || 0} transactions)
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-600">
                          ₱{(teller.totalRemittances || 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          ({teller.remittanceCount || 0} transactions)
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-center">
                        <div className={`text-lg font-bold ${(teller.balance || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          ₱{(teller.balance || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          Final balance
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="space-y-1">
                        <div className="text-sm text-gray-600">
                          {teller.lastActivity || 'No activity'}
                        </div>
                        <div className="flex gap-1 text-xs">
                          {teller.hasActivity && (
                            <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded">Active</span>
                          )}
                          {teller.totalRemittances > 0 && (
                            <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded">Remittances</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        teller.status === 'approved' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : teller.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {teller.status || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}