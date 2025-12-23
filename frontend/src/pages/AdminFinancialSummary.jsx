import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { getApiUrl } from '../utils/apiConfig';
import { Download, RefreshCw, AlertCircle, TrendingUp, DollarSign, Users, Zap } from 'lucide-react';

export default function AdminFinancialSummary() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';
  const API = getApiUrl();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Check if user is SuperAdmin
  if (user?.role !== 'admin' || !user?.isSuperAdmin) {
    return (
      <div className={`p-8 rounded-lg border-2 ${dark ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'}`}>
        <h2 className={dark ? 'text-red-200' : 'text-red-800'}>Access Denied</h2>
        <p className={dark ? 'text-red-300' : 'text-red-700'}>This report is only available to SuperAdmins.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchFinancialSummary();
  }, [selectedDate]);

  const fetchFinancialSummary = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/api/admin/financial-summary/${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000
      });
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch financial summary:', err);
      showToast({ type: 'error', message: 'Failed to load financial summary' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!summary) return;
    // TODO: Implement Excel export
    showToast({ type: 'info', message: 'Export feature coming soon' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="animate-spin mr-2" />
        <span>Loading financial summary...</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={`p-8 rounded-lg border-2 ${dark ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-200'}`}>
        <AlertCircle className="inline mr-2" />
        <span>No financial data available for {selectedDate}</span>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-lg ${dark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Daily Financial Summary</h1>
        <div className="flex gap-4 items-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={`px-4 py-2 rounded border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
          />
          <button
            onClick={fetchFinancialSummary}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Left Column */}
        <div>
          {/* Cash Section */}
          <div className={`p-4 rounded-lg mb-4 ${dark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
            <h3 className="font-bold text-lg mb-3">Cash Position</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Revolving Money:</span>
                <span className="font-semibold">₱{summary.cashPosition?.revolvingMoney?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>System Balance:</span>
                <span className="font-semibold">₱{summary.cashPosition?.systemBalance?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash on Hand:</span>
                <span className="font-semibold">₱{summary.cashPosition?.cashOnHand?.toLocaleString() || '0'}</span>
              </div>
              <hr className={`my-2 ${dark ? 'border-gray-700' : 'border-gray-300'}`} />
              <div className="flex justify-between text-blue-500 font-bold">
                <span>Difference:</span>
                <span>₱{summary.cashPosition?.difference?.toLocaleString() || '0'}</span>
              </div>
            </div>
          </div>

          {/* Salary Section */}
          <div className={`p-4 rounded-lg ${dark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
            <h3 className="font-bold text-lg mb-3">Salary & Over</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Salary:</span>
                <span className="font-semibold">₱{summary.salary?.totalSalary?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>Over:</span>
                <span className="font-semibold text-green-500">+₱{summary.salary?.totalOver?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>OP Commission:</span>
                <span className="font-semibold">₱{summary.salary?.opCommission?.toLocaleString() || '0'}</span>
              </div>
              <hr className={`my-2 ${dark ? 'border-gray-700' : 'border-gray-300'}`} />
              <div className="flex justify-between font-bold">
                <span>Admin Expense:</span>
                <span className="text-red-500">-₱{summary.salary?.adminExpense?.toLocaleString() || '0'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Expense Breakdown */}
          <div className={`p-4 rounded-lg ${dark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
            <h3 className="font-bold text-lg mb-3">Expenses by Role</h3>
            <div className="space-y-2 text-sm">
              {summary.expenseByRole && Object.entries(summary.expenseByRole).map(([role, data]) => (
                <div key={role} className="flex justify-between">
                  <span className="capitalize">{role}:</span>
                  <span className="font-semibold">₱{data.totalSalary?.toLocaleString() || '0'}</span>
                </div>
              )) || <p className="text-gray-500">No expenses recorded</p>}
            </div>
          </div>

          {/* Cashflow Expenses */}
          <div className={`p-4 rounded-lg mt-4 ${dark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
            <h3 className="font-bold text-lg mb-3">Cashflow Expenses</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Petty Cash:</span>
                <span className="font-semibold">₱{summary.expenses?.pettyCash?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>Registration:</span>
                <span className="font-semibold">₱{summary.expenses?.registration?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>Meals:</span>
                <span className="font-semibold">₱{summary.expenses?.meals?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>Water:</span>
                <span className="font-semibold">₱{summary.expenses?.water?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>Thermal:</span>
                <span className="font-semibold">₱{summary.expenses?.thermal?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span>Other:</span>
                <span className="font-semibold">₱{summary.expenses?.other?.toLocaleString() || '0'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Totals */}
      <div className={`p-4 rounded-lg border-2 ${dark ? 'bg-gray-800 border-blue-700' : 'bg-blue-50 border-blue-300'}`}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Payroll Expense</p>
            <p className="text-2xl font-bold text-blue-600">₱{summary.totals?.totalPayrollExpense?.toLocaleString() || '0'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Cash Expense</p>
            <p className="text-2xl font-bold text-green-600">₱{summary.totals?.totalCashExpense?.toLocaleString() || '0'}</p>
          </div>
          <div colSpan={2} className="col-span-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Grand Total</p>
            <p className="text-3xl font-bold text-orange-600">₱{summary.totals?.grandTotal?.toLocaleString() || '0'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
