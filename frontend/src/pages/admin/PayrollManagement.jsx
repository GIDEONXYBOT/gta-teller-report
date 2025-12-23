import React, { useEffect, useState } from "react";
import axios from "axios";
import { Lock, CheckCircle } from "lucide-react";
import { getApiUrl } from "../../utils/apiConfig.js";

export default function PayrollManagement() {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      setError(null);
      const API = getApiUrl();
      const res = await axios.get(`${API}/api/payroll/management`, {
        timeout: 30000
      });
      const data = res.data?.payrolls?.length ? res.data.payrolls : [
        {
          name: "Sample Teller",
          role: "teller",
          baseSalary: 300,
          totalShort: 20,
          totalOver: 10,
          totalDeductions: 0,
          totalSalary: 290,
          approved: false,
          locked: false,
        },
        {
          name: "Sample Supervisor",
          role: "supervisor",
          baseSalary: 400,
          totalShort: 0,
          totalOver: 30,
          totalDeductions: 10,
          totalSalary: 420,
          approved: true,
          locked: false,
        },
      ];
      setPayrolls(data);
    } catch (err) {
      console.error('Failed to load payrolls:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const API = getApiUrl();
      await axios.post(`${API}/api/payroll/approve/${id}`, {}, {
        timeout: 30000
      });
      fetchPayrolls();
    } catch (err) {
      console.error('Failed to approve payroll:', err);
    }
  };

  const handleLock = async (id) => {
    try {
      const API = getApiUrl();
      await axios.post(`${API}/api/payroll/lock/${id}`, {}, {
        timeout: 30000
      });
      fetchPayrolls();
    } catch (err) {
      console.error('Failed to lock payroll:', err);
    }
  };

  useEffect(() => {
    fetchPayrolls();
  }, []);

  if (loading)
    return (
      <div className="text-center text-gray-400 mt-10 animate-pulse">
        Loading Payroll Management...
      </div>
    );

  if (error)
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Failed to Load Payroll Data</h3>
          <p className="text-red-700 dark:text-red-300 text-sm mb-4">{error}</p>
          <button
            onClick={fetchPayrolls}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );

  return (
    <div className="p-6 dark:text-gray-100">
      <h1 className="text-2xl font-bold mb-6">Payroll Management</h1>
      <div className="overflow-x-auto bg-gray-100 dark:bg-gray-800 rounded-xl p-4 shadow">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-indigo-600 text-white">
            <tr>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Role</th>
              <th className="p-2 border">Base</th>
              <th className="p-2 border">Over</th>
              <th className="p-2 border">Short</th>
              <th className="p-2 border">Deduction</th>
              <th className="p-2 border">Total</th>
              <th className="p-2 border">Date</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Action</th>
            </tr>
          </thead>
          <tbody>
            {payrolls.map((p, i) => (
              <tr key={i} className="border hover:bg-gray-200 dark:hover:bg-gray-700">
                <td className="p-2 border">{p.name}</td>
                <td className="p-2 border capitalize">{p.role}</td>
                <td className="p-2 border text-right">₱{p.baseSalary}</td>
                <td className="p-2 border text-right text-green-500">₱{p.totalOver}</td>
                <td className="p-2 border text-right text-red-500">₱{p.totalShort}</td>
                <td className="p-2 border text-right text-yellow-500">₱{p.totalDeductions}</td>
                <td className="p-2 border text-right font-semibold text-indigo-500">
                  ₱{p.totalSalary}
                </td>
                <td className="p-2 border">{p.date}</td>
                <td className="p-2 border text-center">                  {p.locked ? (
                    <span className="text-gray-400 font-semibold">Locked</span>
                  ) : p.approved ? (
                    <span className="text-green-400 font-semibold">Approved</span>
                  ) : (
                    <span className="text-yellow-400 font-semibold">Pending</span>
                  )}
                </td>
                <td className="p-2 border text-center space-x-2">
                  {!p.approved && (
                    <button
                      onClick={() => handleApprove(p._id)}
                      className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 rounded text-white"
                    >
                      <CheckCircle size={16} className="inline mr-1" />
                      Approve
                    </button>
                  )}
                  {p.approved && !p.locked && (
                    <button
                      onClick={() => handleLock(p._id)}
                      className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 rounded text-white"
                    >
                      <Lock size={16} className="inline mr-1" />
                      Lock
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
