import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../utils/apiConfig";

export default function TellerDashboard() {
  const [salaryData, setSalaryData] = useState({
    baseSalary: 0,
    short: 0,
    over: 0,
    terms: 0,
    total: 0,
    claimed: false,
  });
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTellerData();
    fetchPaymentPlans();
    fetchLeaderboard();
  }, []);

  const fetchTellerData = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user._id) {
        setError("Please log in to view your dashboard");
        return;
      }

      // Fetch payroll data
      const payrollResponse = await axios.get(`${API_URL}/api/payroll/user/${user._id}`);
      const payrollData = payrollResponse.data;

      setSalaryData({
        baseSalary: payrollData.baseSalary || 450,
        short: payrollData.short || 0,
        over: payrollData.over || 0,
        terms: payrollData.terms || 0,
        total: (payrollData.baseSalary || 450) - (payrollData.short || 0) + (payrollData.over || 0),
        claimed: payrollData.claimed || false,
      });
    } catch (err) {
      console.error("Error fetching teller data:", err);
      // Fallback to default values if API fails
      setSalaryData({
        baseSalary: 450,
        short: 0,
        over: 0,
        terms: 0,
        total: 450,
        claimed: false,
      });
    }
  };

  const fetchPaymentPlans = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user._id) return;

      const response = await axios.get(`${API_URL}/api/short-payments/active/${user._id}`);
      if (response.data.success) {
        setPaymentPlans(response.data.plans || []);
      }
    } catch (err) {
      console.error("Error fetching payment plans:", err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      // Fetch employee of the month data
      const leaderboardResponse = await axios.get(`${API_URL}/api/admin/employee-of-month`);
      const leaderboardData = leaderboardResponse.data;
      
      if (leaderboardData && leaderboardData.length > 0) {
        setLeaderboard(leaderboardData.map(emp => emp.name || emp.username));
      } else {
        // Fallback data
        setLeaderboard(["Top performers will appear here"]);
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      // Fallback data
      setLeaderboard(["Marites", "Juan", "Ana Supervisor", "Liza"]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold text-indigo-600 mb-6">Teller Dashboard</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md">
              <h2 className="text-sm text-gray-500">Base Salary</h2>
              <p className="text-2xl font-bold text-indigo-600">₱{salaryData.baseSalary.toLocaleString()}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md">
              <h2 className="text-sm text-gray-500">Short Deduction</h2>
              <p className="text-2xl font-bold text-red-500">₱{salaryData.short.toLocaleString()}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md">
              <h2 className="text-sm text-gray-500">Over Addition</h2>
              <p className="text-2xl font-bold text-green-500">₱{salaryData.over.toLocaleString()}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md">
              <h2 className="text-sm text-gray-500">Terms to Pay</h2>
              <p className="text-2xl font-bold">{salaryData.terms}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md mb-10">
            <h2 className="text-xl font-semibold text-indigo-600 mb-3">Total Withdrawable Salary</h2>
            <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-400">₱{salaryData.total.toLocaleString()}</p>
            <p className="text-sm mt-2">
              Status:{" "}\
              {salaryData.claimed ? (
                <span className="text-green-500 font-semibold">Claimed</span>
              ) : (
                <span className="text-yellow-500 font-semibold">Pending</span>
              )}
            </p>
          </div>

          {/* Payment Plans Section */}
          {paymentPlans.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md mb-10">
              <h2 className="text-xl font-semibold text-orange-600 mb-4">💳 Active Payment Plans</h2>
              <div className="space-y-4">
                {paymentPlans.map((plan) => (
                  <div key={plan._id} className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Short Amount</div>
                        <div className="text-2xl font-bold text-orange-600">₱{plan.totalAmount.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Weekly Deduction</div>
                        <div className="text-xl font-semibold text-red-600">-₱{plan.weeklyAmount.toLocaleString()}</div>
                      </div>
                    </div>
                    
                    <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Progress:</span>
                          <span className="ml-2 font-semibold">Week {plan.weeksPaid} of {plan.weeksTotal}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
                          <span className="ml-2 font-semibold">{plan.weeksTotal - plan.weeksPaid} weeks</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Paid so far:</span>
                          <span className="ml-2 font-semibold text-green-600">₱{(plan.weeksPaid * plan.weeklyAmount).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Balance:</span>
                          <span className="ml-2 font-semibold text-orange-600">₱{(plan.totalAmount - (plan.weeksPaid * plan.weeklyAmount)).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-orange-600 h-2 rounded-full transition-all"
                          style={{ width: `${(plan.weeksPaid / plan.weeksTotal) * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-center">
                        {Math.round((plan.weeksPaid / plan.weeksTotal) * 100)}% Complete
                      </div>
                    </div>
                    
                    {plan.note && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">
                        Note: {plan.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold text-indigo-600 mb-3">Employee of the Month</h2>
            <ul className="list-decimal pl-6 space-y-1 text-gray-800 dark:text-gray-200">
              {leaderboard.map((name, i) => (
                <li key={i} className={`${i === 0 ? "font-bold text-green-500" : ""}`}>
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
