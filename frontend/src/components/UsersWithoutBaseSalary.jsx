import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

export default function UsersWithoutBaseSalary() {
  const { settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsersWithoutBaseSalary();
  }, []);

  const fetchUsersWithoutBaseSalary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${getApiUrl()}/api/payroll/check/no-base-salary`);
      
      if (res.data.success) {
        setUsers(res.data.users || []);
        if (res.data.count > 0) {
          showToast({
            type: 'warning',
            message: `⚠️ Found ${res.data.count} users without base salary`
          });
        }
      }
    } catch (err) {
      console.error('Error fetching users without base salary:', err);
      setError(err.response?.data?.message || 'Failed to load users');
      showToast({
        type: 'error',
        message: 'Failed to load users without base salary'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="ml-2">Checking users...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 rounded-lg border ${dark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-200">Error</h3>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className={`p-4 rounded-lg border ${dark ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'}`}>
        <p className="text-green-800 dark:text-green-200">✅ All users have base salary configured!</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg shadow p-6 ${dark ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <h2 className="text-lg font-semibold">Users Without Base Salary</h2>
        </div>
        <button
          onClick={fetchUsersWithoutBaseSalary}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className={`min-w-full divide-y ${dark ? 'divide-gray-700' : 'divide-gray-200'}`}>
          <thead className={dark ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Base Salary
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Latest Payroll
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${dark ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
            {users.map((user) => (
              <tr key={user._id} className={dark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {user.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {user.email || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                    ₱0.00
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {user.latestPayroll ? (
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {user.latestPayroll.baseSalary ? `Base: ₱${user.latestPayroll.baseSalary}` : 'No base'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(user.latestPayroll.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">No payroll yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`mt-4 p-3 rounded text-sm ${dark ? 'bg-yellow-900/20 text-yellow-200' : 'bg-yellow-50 text-yellow-800'}`}>
        <strong>⚠️ Action Required:</strong> These {users.length} user(s) need base salary configuration. Use the Payroll Base Salary Fixer to set their salaries.
      </div>
    </div>
  );
}
