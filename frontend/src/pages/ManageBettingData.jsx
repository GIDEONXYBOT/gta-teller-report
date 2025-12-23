// frontend/src/pages/ManageBettingData.jsx
import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext.jsx';
import { getApiUrl } from '../utils/apiConfig.js';
import { Upload, Trash2, Plus, Download } from 'lucide-react';

export default function ManageBettingData() {
  const { user, settings } = useContext(SettingsContext);
  const API = getApiUrl();
  
  const [bettingData, setBettingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ username: '', totalBet: '', mwBetPercent: '' });
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const isDark = settings?.theme?.mode === 'dark';
  const bg = isDark ? '#0f172a' : '#f8fafc';

  // Check if user has permission
  const canAccess = ['admin', 'super_admin'].includes(user?.role);

  // Fetch betting data
  const fetchBettingData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/api/betting-data/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBettingData(response.data.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch betting data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) {
      fetchBettingData();
    }
  }, [canAccess]);

  // Add new entry
  const handleAddEntry = async () => {
    if (!newEntry.username || !newEntry.totalBet || !newEntry.mwBetPercent) {
      setError('All fields required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/api/betting-data/add`, newEntry, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewEntry({ username: '', totalBet: '', mwBetPercent: '' });
      setShowAddForm(false);
      setError(null);
      fetchBettingData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add entry');
    }
  };

  // Update entry
  const handleUpdateEntry = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/api/betting-data/${id}`, editData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingId(null);
      setEditData({});
      setError(null);
      fetchBettingData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update entry');
    }
  };

  // Delete entry
  const handleDeleteEntry = async (id) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/api/betting-data/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setError(null);
      fetchBettingData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete entry');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const csv = [
      ['Username', 'Total Bet', 'M/W Bet %'],
      ...bettingData.map(item => [item.username, item.totalBet, item.mwBetPercent])
    ]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `betting-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (!canAccess) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600">Access denied. Only admins can manage betting data.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" style={{ background: bg }}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">📊 Manage Betting Data</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={16} />
            Add Entry
          </button>
        </div>
      </div>

      {/* Error Box */}
      {error && (
        <div className={`p-4 rounded ${isDark ? 'bg-red-900 text-red-100' : 'bg-red-50 text-red-800'}`}>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className={`p-4 rounded border space-y-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className="font-semibold">Add New Entry</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Username"
              value={newEntry.username}
              onChange={(e) => setNewEntry({ ...newEntry, username: e.target.value })}
              className={`px-3 py-2 rounded border text-sm ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
            />
            <input
              type="number"
              placeholder="Total Bet"
              value={newEntry.totalBet}
              onChange={(e) => setNewEntry({ ...newEntry, totalBet: e.target.value })}
              className={`px-3 py-2 rounded border text-sm ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
            />
            <input
              type="number"
              placeholder="M/W Bet %"
              step="0.1"
              value={newEntry.mwBetPercent}
              onChange={(e) => setNewEntry({ ...newEntry, mwBetPercent: e.target.value })}
              className={`px-3 py-2 rounded border text-sm ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddEntry}
              className="px-4 py-2 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className={`px-4 py-2 rounded text-sm font-medium ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div className="text-center py-8">Loading betting data...</div>}

      {/* Data Table */}
      {!loading && bettingData.length > 0 && (
        <div className={`rounded border overflow-x-auto ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <table className="w-full text-sm">
            <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Username</th>
                <th className="px-4 py-3 text-right font-semibold">Total Bet</th>
                <th className="px-4 py-3 text-right font-semibold">M/W Bet %</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bettingData.map((item) => (
                <tr
                  key={item._id}
                  className={`border-t ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  {editingId === item._id ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editData.username || ''}
                          onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                          className={`w-full px-2 py-1 rounded border text-sm ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={editData.totalBet || ''}
                          onChange={(e) => setEditData({ ...editData, totalBet: e.target.value })}
                          className={`w-full px-2 py-1 rounded border text-sm text-right ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.1"
                          value={editData.mwBetPercent || ''}
                          onChange={(e) => setEditData({ ...editData, mwBetPercent: e.target.value })}
                          className={`w-full px-2 py-1 rounded border text-sm text-right ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center space-x-2">
                        <button
                          onClick={() => handleUpdateEntry(item._id)}
                          className="px-3 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className={`px-3 py-1 rounded text-xs ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
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
                      <td className="px-4 py-3 text-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingId(item._id);
                            setEditData(item);
                          }}
                          className="px-3 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(item._id)}
                          className="px-3 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 inline-flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && bettingData.length === 0 && (
        <div className={`p-8 rounded text-center ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <p className="text-gray-500">No betting data. Click "Add Entry" to get started.</p>
        </div>
      )}
    </div>
  );
}
