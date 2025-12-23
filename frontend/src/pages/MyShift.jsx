import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import {
  Users,
  ArrowRightLeft,
  Briefcase,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

/**
 * MyShift.jsx
 * Allows supervisors to shift their role for the day
 * Automatically adjusts base salary based on role worked
 */
export default function MyShift() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [todayShift, setTodayShift] = useState(null);
  const [roleWorkedAs, setRoleWorkedAs] = useState("");
  const [hasCapitalToday, setHasCapitalToday] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Get base salaries from settings
  const baseSalaries = {
    teller: settings?.baseSalaries?.teller || settings?.baseSalary?.teller || user?.baseSalary || 450,
    supervisor: settings?.baseSalaries?.supervisor || settings?.baseSalary?.supervisor || user?.baseSalary || 600,
    supervisor_teller: settings?.baseSalaries?.supervisor_teller || settings?.baseSalary?.supervisor || user?.baseSalary || 600,
    admin: settings?.baseSalaries?.admin || settings?.baseSalary?.admin || 0,
    head_watcher: settings?.baseSalaries?.head_watcher || settings?.baseSalary?.head_watcher || 450,
    sub_watcher: settings?.baseSalaries?.sub_watcher || settings?.baseSalary?.sub_watcher || 400,
  };

  useEffect(() => {
    if (user) {
      fetchTodayShift();
      checkCapitalToday();
    }
  }, [user]);

  const fetchTodayShift = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${getApiUrl()}/api/shift/today/${user._id}`);
      if (res.data.shift) {
        setTodayShift(res.data.shift);
        setRoleWorkedAs(res.data.shift.roleWorkedAs);
      } else {
        // No shift record yet, default to user's actual role
        setRoleWorkedAs(user.role);
      }
    } catch (err) {
      console.error("Error fetching today's shift:", err);
      setRoleWorkedAs(user.role);
    } finally {
      setLoading(false);
    }
  };

  const checkCapitalToday = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/teller-management/capital/check-today/${user._id}`);
      setHasCapitalToday(res.data.hasCapital || false);
    } catch (err) {
      console.error("Error checking capital:", err);
    }
  };

  const handleShiftRole = async () => {
    if (!roleWorkedAs) {
      showToast({ type: "warning", message: "Please select a role" });
      return;
    }

    if (roleWorkedAs === user.role && !todayShift) {
      showToast({ type: "info", message: "This is already your assigned role" });
      return;
    }

    try {
      setProcessing(true);
      const res = await axios.post(`${getApiUrl()}/api/shift/set`, {
        userId: user._id,
        roleWorkedAs,
        date: today,
      });

      setTodayShift(res.data.shift);
      showToast({ 
        type: "success", 
        message: `Shift set to ${roleWorkedAs.replace('_', ' ').toUpperCase()}` 
      });
      
      // Refresh to update payroll
      await fetchTodayShift();
      await checkCapitalToday();
    } catch (err) {
      console.error("Error setting shift:", err);
      showToast({ 
        type: "error", 
        message: err.response?.data?.message || "Failed to set shift" 
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${dark ? "bg-gray-900" : "bg-gray-50"}`}>
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Only supervisors can use this feature
  if (!user.role.includes("supervisor")) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen p-6 ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
        <AlertCircle className="w-16 h-16 mb-4 text-yellow-500" />
        <h1 className="text-2xl font-bold mb-2">Access Restricted</h1>
        <p className="text-gray-500">This feature is only available for supervisors</p>
      </div>
    );
  }

  const currentBaseSalary = baseSalaries[roleWorkedAs] || baseSalaries[user.role] || 450;

  return (
    <div className={`min-h-screen p-6 ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowRightLeft className="w-8 h-8 text-purple-500" />
            My Shift
          </h1>
          <p className="text-gray-500 mt-2">Manage your work role for today</p>
        </div>

        {/* Current Status Card */}
        <div className={`mb-6 p-6 rounded-xl shadow-lg ${dark ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Today's Status
            </h2>
            <div className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg ${dark ? "bg-gray-700" : "bg-blue-50"}`}>
              <div className="text-sm text-gray-500 mb-1">Assigned Role</div>
              <div className="font-semibold text-lg capitalize">
                {user.role.replace('_', ' ')}
              </div>
            </div>

            <div className={`p-4 rounded-lg ${dark ? "bg-gray-700" : "bg-purple-50"}`}>
              <div className="text-sm text-gray-500 mb-1">Working As</div>
              <div className="font-semibold text-lg capitalize text-purple-600">
                {todayShift?.roleWorkedAs?.replace('_', ' ') || user.role.replace('_', ' ')}
              </div>
            </div>

            <div className={`p-4 rounded-lg ${dark ? "bg-gray-700" : "bg-green-50"}`}>
              <div className="text-sm text-gray-500 mb-1">Today's Base Salary</div>
              <div className="font-semibold text-lg text-green-600">
                ₱{currentBaseSalary.toLocaleString()}
              </div>
            </div>
          </div>

          {hasCapitalToday && (
            <div className="mt-4 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Capital assigned today</span>
              </div>
            </div>
          )}
        </div>

        {/* Shift Role Card */}
        <div className={`p-6 rounded-xl shadow-lg ${dark ? "bg-gray-800" : "bg-white"}`}>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Change Work Role
          </h2>

          <p className="text-sm text-gray-500 mb-6">
            Select the role you're working as today. Your base salary will automatically adjust based on the role you choose.
          </p>

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">Select Role for Today</label>
            <div className="grid md:grid-cols-2 gap-3">
              {['supervisor', 'teller', 'supervisor_teller'].map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleWorkedAs(role)}
                  disabled={processing}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    roleWorkedAs === role
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30"
                      : dark
                      ? "border-gray-600 bg-gray-700 hover:border-gray-500"
                      : "border-gray-300 bg-white hover:border-gray-400"
                  } ${processing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="font-semibold capitalize mb-1">
                        {role.replace('_', ' ')}
                      </div>
                      <div className="text-sm text-gray-500">
                        Base: ₱{baseSalaries[role]?.toLocaleString()}
                      </div>
                    </div>
                    {roleWorkedAs === role && (
                      <CheckCircle className="w-5 h-5 text-purple-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Information Box */}
          <div className={`p-4 rounded-lg mb-6 ${dark ? "bg-blue-900/30 border border-blue-700" : "bg-blue-50 border border-blue-200"}`}>
            <div className="flex gap-3">
              <DollarSign className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-300 mb-2">How it works:</p>
                <ul className="space-y-1 text-blue-600 dark:text-blue-400">
                  <li>• When you shift to <strong>Teller</strong>, you'll receive teller base salary (₱{baseSalaries.teller})</li>
                  <li>• When you add capital as <strong>Teller</strong>, you'll receive supervisor base salary (₱{baseSalaries.supervisor})</li>
                  <li>• Your payroll will automatically use the correct base salary</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleShiftRole}
            disabled={processing || loading || roleWorkedAs === (todayShift?.roleWorkedAs || user.role)}
            className="w-full py-3 px-4 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Updating Shift...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-5 h-5" />
                Set Work Role for Today
              </>
            )}
          </button>

          {todayShift && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Last updated: {new Date(todayShift.updatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className={`mt-6 p-4 rounded-lg ${dark ? "bg-gray-800" : "bg-gray-100"}`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="font-medium mb-1">Important Notes:</p>
              <ul className="space-y-1">
                <li>• This only affects your role for today</li>
                <li>• Your official role assignment remains unchanged</li>
                <li>• Payroll calculations will use the role you select here</li>
                <li>• You can change your shift role anytime during the day</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
