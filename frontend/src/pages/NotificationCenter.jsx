import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import {
  Bell,
  Settings as SettingsIcon,
  Trash2,
  Plus,
  Save,
  X,
  AlertCircle,
  TrendingUp,
  Mail,
  Smartphone,
} from "lucide-react";

const NotificationCenter = () => {
  const { isDarkMode } = useContext(SettingsContext);
  const { addToast } = useToast();
  const API = getApiUrl();

  const [notifications, setNotifications] = useState([]);
  const [alertRules, setAlertRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [newRule, setNewRule] = useState({
    name: "",
    type: "betting_threshold", // betting_threshold, activity_change, performance_drop
    threshold: 50000,
    condition: "greater_than", // greater_than, less_than, equals
    channels: ["in_app"], // in_app, email, sms
    enabled: true,
  });

  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    inAppNotifications: true,
    emailAddress: "",
    phoneNumber: "",
  });

  useEffect(() => {
    fetchData();
    // Set up polling for real-time notifications
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch notifications
      const notifRes = await axios.get(`${API}/api/notifications/list`, { headers });
      if (notifRes.data.success) {
        setNotifications(notifRes.data.data);
      }

      // Fetch alert rules
      const rulesRes = await axios.get(`${API}/api/notifications/rules`, { headers });
      if (rulesRes.data.success) {
        setAlertRules(rulesRes.data.data);
      }

      // Fetch settings
      const settingsRes = await axios.get(`${API}/api/notifications/settings`, { headers });
      if (settingsRes.data.success) {
        setSettings(settingsRes.data.data);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to fetch data";
      addToast(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await axios.get(`${API}/api/notifications/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setNotifications(response.data.data);
      }
    } catch (err) {
      // Silently fail on polling
    }
  };

  const handleAddRule = async () => {
    if (!newRule.name.trim()) {
      addToast("Rule name is required", "error");
      return;
    }

    if (newRule.channels.length === 0) {
      addToast("Select at least one notification channel", "error");
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const response = await axios.post(
        `${API}/api/notifications/rules/create`,
        newRule,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setAlertRules([...alertRules, response.data.data]);
        setNewRule({
          name: "",
          type: "betting_threshold",
          threshold: 50000,
          condition: "greater_than",
          channels: ["in_app"],
          enabled: true,
        });
        setShowAddRule(false);
        addToast("Alert rule created successfully", "success");
      }
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to create rule", "error");
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm("Delete this alert rule?")) return;

    try {
      const token = localStorage.getItem("authToken");
      await axios.delete(`${API}/api/notifications/rules/${ruleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setAlertRules(alertRules.filter((r) => r._id !== ruleId));
      addToast("Rule deleted successfully", "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to delete rule", "error");
    }
  };

  const handleToggleRule = async (ruleId, enabled) => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await axios.put(
        `${API}/api/notifications/rules/${ruleId}`,
        { enabled: !enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setAlertRules(
          alertRules.map((r) =>
            r._id === ruleId ? { ...r, enabled: !enabled } : r
          )
        );
      }
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to update rule", "error");
    }
  };

  const handleSaveSettings = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await axios.put(
        `${API}/api/notifications/settings`,
        settings,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        addToast("Settings saved successfully", "success");
        setShowSettings(false);
      }
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to save settings", "error");
    }
  };

  const handleDeleteNotification = async (notifId) => {
    try {
      const token = localStorage.getItem("authToken");
      await axios.delete(`${API}/api/notifications/${notifId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications(notifications.filter((n) => n._id !== notifId));
      addToast("Notification deleted", "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to delete notification", "error");
    }
  };

  const NotificationItem = ({ notification }) => {
    const getIcon = (type) => {
      switch (type) {
        case "betting_threshold":
          return <TrendingUp className="text-orange-500" />;
        case "activity_change":
          return <AlertCircle className="text-yellow-500" />;
        case "performance_drop":
          return <TrendingUp className="text-red-500 rotate-180" />;
        default:
          return <Bell className="text-blue-500" />;
      }
    };

    const getStatusColor = (read) => {
      return read ? "opacity-50" : isDarkMode ? "bg-gray-700" : "bg-blue-50";
    };

    return (
      <div
        className={`p-4 rounded-lg border ${
          isDarkMode
            ? `${getStatusColor(notification.read)} border-gray-700`
            : `${getStatusColor(notification.read)} border-gray-200`
        } flex items-start justify-between`}
      >
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-1">{getIcon(notification.type)}</div>
          <div className="flex-1">
            <h4 className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              {notification.title}
            </h4>
            <p className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {notification.message}
            </p>
            <p className={`text-xs mt-2 ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
              {new Date(notification.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <button
          onClick={() => handleDeleteNotification(notification._id)}
          className="p-2 hover:bg-red-500 hover:bg-opacity-20 text-red-500 rounded ml-2"
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  const AlertRuleItem = ({ rule }) => {
    const typeLabels = {
      betting_threshold: "Betting Threshold Alert",
      activity_change: "Activity Change Alert",
      performance_drop: "Performance Drop Alert",
    };

    return (
      <div
        className={`p-4 rounded-lg border ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
              {rule.name}
            </h4>
            <p className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {typeLabels[rule.type] || rule.type}
            </p>
            <div className="flex gap-2 mt-2">
              {rule.channels.includes("email") && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-500 bg-opacity-20 text-purple-500">
                  <Mail size={12} />
                  Email
                </span>
              )}
              {rule.channels.includes("sms") && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-500 bg-opacity-20 text-green-500">
                  <Smartphone size={12} />
                  SMS
                </span>
              )}
              {rule.channels.includes("in_app") && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500 bg-opacity-20 text-blue-500">
                  <Bell size={12} />
                  In-App
                </span>
              )}
            </div>
            {rule.type === "betting_threshold" && (
              <p className={`text-xs mt-2 ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                Threshold: ₱{rule.threshold?.toLocaleString()} ({rule.condition})
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleRule(rule._id, rule.enabled)}
              className={`px-3 py-1 rounded text-sm font-medium ${
                rule.enabled
                  ? "bg-green-500 text-white"
                  : "bg-gray-500 text-white"
              }`}
            >
              {rule.enabled ? "Enabled" : "Disabled"}
            </button>
            <button
              onClick={() => handleDeleteRule(rule._id)}
              className="p-2 hover:bg-red-500 hover:bg-opacity-20 text-red-500 rounded"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen p-8 ${isDarkMode ? "bg-gray-900" : "bg-gray-50"}`}>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            Notification Center
          </h1>
          <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            Manage alerts and real-time notifications for betting activity
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white flex items-center gap-2"
          >
            <SettingsIcon size={18} />
            Settings
          </button>
          <button
            onClick={() => setShowAddRule(true)}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
          >
            <Plus size={18} />
            Add Alert Rule
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-full max-w-md ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Notification Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.inAppNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, inAppNotifications: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                  In-App Notifications
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, emailNotifications: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                  Email Notifications
                </span>
              </label>

              {settings.emailNotifications && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={settings.emailAddress}
                    onChange={(e) =>
                      setSettings({ ...settings, emailAddress: e.target.value })
                    }
                    placeholder="your@email.com"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300"
                    }`}
                  />
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.smsNotifications}
                  onChange={(e) =>
                    setSettings({ ...settings, smsNotifications: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                  SMS Notifications
                </span>
              </label>

              {settings.smsNotifications && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={settings.phoneNumber}
                    onChange={(e) =>
                      setSettings({ ...settings, phoneNumber: e.target.value })
                    }
                    placeholder="+63 9XX XXX XXXX"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300"
                    }`}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveSettings}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Save Settings
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className={`flex-1 px-4 py-2 rounded-lg border ${
                    isDarkMode
                      ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Alert Rule Modal */}
      {showAddRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-full max-w-md max-h-96 overflow-y-auto ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Create Alert Rule
              </h2>
              <button
                onClick={() => setShowAddRule(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g., High Betting Alert"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Alert Type *
                </label>
                <select
                  value={newRule.type}
                  onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300"
                  }`}
                >
                  <option value="betting_threshold">Betting Threshold</option>
                  <option value="activity_change">Activity Change</option>
                  <option value="performance_drop">Performance Drop</option>
                </select>
              </div>

              {newRule.type === "betting_threshold" && (
                <>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                      Threshold Amount (₱)
                    </label>
                    <input
                      type="number"
                      value={newRule.threshold}
                      onChange={(e) => setNewRule({ ...newRule, threshold: parseInt(e.target.value) })}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300"
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                      Condition
                    </label>
                    <select
                      value={newRule.condition}
                      onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      <option value="greater_than">Greater Than</option>
                      <option value="less_than">Less Than</option>
                      <option value="equals">Equals</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Notification Channels *
                </label>
                <div className="space-y-2">
                  {["in_app", "email", "sms"].map((channel) => (
                    <label key={channel} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRule.channels.includes(channel)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewRule({
                              ...newRule,
                              channels: [...newRule.channels, channel],
                            });
                          } else {
                            setNewRule({
                              ...newRule,
                              channels: newRule.channels.filter((c) => c !== channel),
                            });
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                        {channel === "in_app" ? "In-App" : channel.toUpperCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddRule}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Create Rule
                </button>
                <button
                  onClick={() => setShowAddRule(false)}
                  className={`flex-1 px-4 py-2 rounded-lg border ${
                    isDarkMode
                      ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Notifications */}
        <div className="lg:col-span-2">
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            Recent Notifications ({notifications.length})
          </h2>
          <div className="space-y-3">
            {notifications.length > 0 ? (
              notifications.slice(0, 10).map((notif) => (
                <NotificationItem key={notif._id} notification={notif} />
              ))
            ) : (
              <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                No notifications yet
              </p>
            )}
          </div>
        </div>

        {/* Active Alert Rules */}
        <div>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            Active Rules ({alertRules.filter((r) => r.enabled).length})
          </h2>
          <div className="space-y-3">
            {alertRules.length > 0 ? (
              alertRules.map((rule) => (
                <AlertRuleItem key={rule._id} rule={rule} />
              ))
            ) : (
              <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                No alert rules created yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
