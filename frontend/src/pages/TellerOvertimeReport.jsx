import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { getApiUrl } from '../utils/apiConfig';
import { Loader2, RefreshCw } from 'lucide-react';

export default function TellerOvertimeReport() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';

  const [tellers, setTellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date().toISOString().split('T')[0]);
  const [weekData, setWeekData] = useState({});

  // Check if user is superadmin or supervisor
  const isSuperAdminOrSupervisor = user?.role === 'superadmin' || user?.role === 'supervisor';

  useEffect(() => {
    if (!isSuperAdminOrSupervisor) {
      showToast({ type: 'error', message: 'Access denied. Only superadmin and supervisors can view this page.' });
      return;
    }
    fetchTellerOvertimeData();
  }, [selectedWeek]);

  const fetchTellerOvertimeData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Get the week start (Monday)
      const date = new Date(selectedWeek);
      const dayOfWeek = date.getDay();
      const diffToMonday = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(date.setDate(diffToMonday));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 4); // Friday

      const response = await axios.get(
        `${getApiUrl()}/api/teller-overtime-report`,
        {
          params: {
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            supervisorId: user?.role === 'supervisor' ? user?.id : undefined
          },
          headers
        }
      );

      setTellers(response.data.tellers || []);
      setWeekData({
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0]
      });
      showToast({ type: 'success', message: `Loaded ${response.data.tellers?.length || 0} tellers` });
    } catch (err) {
      console.error('Error fetching overtime data:', err);
      showToast({ type: 'error', message: err.response?.data?.message || 'Failed to load teller data' });
      setTellers([]);
    } finally {
      setLoading(false);
    }
  };

  const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const handleWeekChange = (e) => {
    setSelectedWeek(e.target.value);
  };

  const handlePreviousWeek = () => {
    const date = new Date(selectedWeek);
    date.setDate(date.getDate() - 7);
    setSelectedWeek(date.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const date = new Date(selectedWeek);
    date.setDate(date.getDate() + 7);
    setSelectedWeek(date.toISOString().split('T')[0]);
  };

  if (!isSuperAdminOrSupervisor) {
    return (
      <div className={`${dark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} p-8 rounded-lg text-center`}>
        <div className="text-2xl font-bold text-red-500">Access Denied</div>
        <p className="mt-4">Only superadmin and supervisors can access this page.</p>
      </div>
    );
  }

  return (
    <div className={`${dark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} min-h-screen p-6`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Teller Weekly Overtime Report</h1>
        <p className={`${dark ? 'text-gray-400' : 'text-gray-600'}`}>View teller overtime hours and base salary (Monday - Friday)</p>
      </div>

      {/* Week Selection Controls */}
      <div className={`${dark ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg p-6 mb-8 border ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={handlePreviousWeek}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            ← Previous Week
          </button>
          
          <div className="flex items-center gap-2">
            <label className="font-semibold">Select Week (Monday):</label>
            <input
              type="date"
              value={selectedWeek}
              onChange={handleWeekChange}
              className={`px-4 py-2 rounded-lg border ${
                dark 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>
          
          <button
            onClick={handleNextWeek}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Next Week →
          </button>

          <button
            onClick={fetchTellerOvertimeData}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw size={18} /> Refresh
          </button>
        </div>

        {weekData.weekStart && (
          <div className={`mt-4 text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
            Week: {weekData.weekStart} to {weekData.weekEnd} (Mon-Fri)
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 size={48} className="animate-spin text-blue-500" />
        </div>
      ) : (
        /* Tellers Table */
        <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-lg overflow-hidden border ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
          {tellers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${dark ? 'bg-gray-700' : 'bg-gray-100'} border-b ${dark ? 'border-gray-600' : 'border-gray-200'}`}>
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Teller Name</th>
                    <th className="px-6 py-4 text-center font-semibold">Base Salary</th>
                    <th className="px-6 py-4 text-center font-semibold">Mon</th>
                    <th className="px-6 py-4 text-center font-semibold">Tue</th>
                    <th className="px-6 py-4 text-center font-semibold">Wed</th>
                    <th className="px-6 py-4 text-center font-semibold">Thu</th>
                    <th className="px-6 py-4 text-center font-semibold">Fri</th>
                    <th className="px-6 py-4 text-center font-semibold">Weekly Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tellers.map((teller, index) => {
                    const weeklyTotal = (teller.overtime?.mon || 0) + 
                                      (teller.overtime?.tue || 0) + 
                                      (teller.overtime?.wed || 0) + 
                                      (teller.overtime?.thu || 0) + 
                                      (teller.overtime?.fri || 0);
                    
                    return (
                      <tr
                        key={teller.id || index}
                        className={`border-b ${
                          dark
                            ? 'border-gray-700 hover:bg-gray-700'
                            : 'border-gray-200 hover:bg-gray-50'
                        } transition-colors`}
                      >
                        <td className="px-6 py-4 font-semibold">{teller.name}</td>
                        <td className="px-6 py-4 text-center font-semibold text-green-500">
                          ₱{(teller.baseSalary || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="bg-blue-500 text-white rounded px-2 py-1 inline-block">
                            {teller.overtime?.mon || 0}h
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="bg-blue-500 text-white rounded px-2 py-1 inline-block">
                            {teller.overtime?.tue || 0}h
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="bg-blue-500 text-white rounded px-2 py-1 inline-block">
                            {teller.overtime?.wed || 0}h
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="bg-blue-500 text-white rounded px-2 py-1 inline-block">
                            {teller.overtime?.thu || 0}h
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="bg-blue-500 text-white rounded px-2 py-1 inline-block">
                            {teller.overtime?.fri || 0}h
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold">
                          <div className="bg-purple-600 text-white rounded px-3 py-1 inline-block">
                            {weeklyTotal}h
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className={`${dark ? 'text-gray-400' : 'text-gray-600'}`}>No teller data available for the selected week.</p>
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      {tellers.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`${dark ? 'bg-gray-800' : 'bg-blue-50'} p-6 rounded-lg border ${dark ? 'border-gray-700' : 'border-blue-200'}`}>
            <p className={`${dark ? 'text-gray-400' : 'text-gray-600'}`}>Total Tellers</p>
            <p className="text-3xl font-bold text-blue-600">{tellers.length}</p>
          </div>
          
          <div className={`${dark ? 'bg-gray-800' : 'bg-green-50'} p-6 rounded-lg border ${dark ? 'border-gray-700' : 'border-green-200'}`}>
            <p className={`${dark ? 'text-gray-400' : 'text-gray-600'}`}>Avg Base Salary</p>
            <p className="text-3xl font-bold text-green-600">
              ₱{Math.round(tellers.reduce((sum, t) => sum + (t.baseSalary || 0), 0) / tellers.length).toLocaleString()}
            </p>
          </div>

          <div className={`${dark ? 'bg-gray-800' : 'bg-purple-50'} p-6 rounded-lg border ${dark ? 'border-gray-700' : 'border-purple-200'}`}>
            <p className={`${dark ? 'text-gray-400' : 'text-gray-600'}`}>Total Weekly OT Hours</p>
            <p className="text-3xl font-bold text-purple-600">
              {tellers.reduce((sum, t) => {
                const total = (t.overtime?.mon || 0) + (t.overtime?.tue || 0) + (t.overtime?.wed || 0) + (t.overtime?.thu || 0) + (t.overtime?.fri || 0);
                return sum + total;
              }, 0)}h
            </p>
          </div>

          <div className={`${dark ? 'bg-gray-800' : 'bg-orange-50'} p-6 rounded-lg border ${dark ? 'border-gray-700' : 'border-orange-200'}`}>
            <p className={`${dark ? 'text-gray-400' : 'text-gray-600'}`}>Avg Weekly OT</p>
            <p className="text-3xl font-bold text-orange-600">
              {Math.round(
                tellers.reduce((sum, t) => {
                  const total = (t.overtime?.mon || 0) + (t.overtime?.tue || 0) + (t.overtime?.wed || 0) + (t.overtime?.thu || 0) + (t.overtime?.fri || 0);
                  return sum + total;
                }, 0) / tellers.length
              )}h
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
