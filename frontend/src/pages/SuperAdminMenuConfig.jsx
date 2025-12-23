import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import {
  Shield,
  Save,
  RefreshCw,
  CheckSquare,
  Square,
  Users,
  LayoutDashboard,
  FileText,
  DollarSign,
  Calendar,
  Settings as SettingsIcon,
  TrendingUp,
  Camera,
  BarChart3,
  UserCog,
  Briefcase,
  FileBarChart,
  Wallet,
  ChevronsUp,
  MapPin,
  Map,
  Link,
  Wifi,
} from "lucide-react";


// Define all available menu items with icons and labels
// Canonical and legacy IDs are mapped in SidebarLayout; expose all useful pages here
const AVAILABLE_MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller", "declarator", "supervisor_teller"] },
  { id: "teller-management", label: "Teller Management", icon: <Users size={16} />, allowedRoles: ["super_admin", "admin", "supervisor"] },
  { id: "supervisor-report", label: "Supervisor Reports", icon: <FileText size={16} />, allowedRoles: ["super_admin", "admin", "supervisor"] },
  { id: "teller-reports", label: "Teller Reports", icon: <FileText size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller"] },
  { id: "teller-reports-viewer", label: "Reports Viewer", icon: <FileBarChart size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller"] },
  { id: "teller-overview", label: "Teller Overview", icon: <FileBarChart size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "report", label: "Admin Report", icon: <FileBarChart size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "cashflow", label: "Cashflow", icon: <TrendingUp size={16} />, allowedRoles: ["super_admin", "admin", "supervisor"] },
  { id: "user-approval", label: "User Approvals", icon: <Users size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "withdrawals", label: "Withdrawal Approvals", icon: <Wallet size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "employees", label: "Employee Management", icon: <Briefcase size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "salary", label: "My Salary", icon: <Wallet size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "payroll", label: "Payroll", icon: <DollarSign size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller"] },
  { id: "payroll-fixer", label: "Payroll Base Salary Fixer", icon: <DollarSign size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "my-shift", label: "My Shift", icon: <Users size={16} />, allowedRoles: ["supervisor", "supervisor_teller"] },
  { id: "history", label: "History", icon: <FileText size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller"] },
  { id: "teller-month", label: "Teller of the Month", icon: <Users size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller"] },
  { id: "suggested-schedule", label: "Suggested Schedule", icon: <Calendar size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller"] },
  { id: "attendance-scheduler", label: "Attendance Scheduler", icon: <Calendar size={16} />, allowedRoles: ["super_admin", "admin", "supervisor"] },
  { id: "deployments", label: "Deployment Management", icon: <FileText size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller", "declarator"] },
  { id: "assistant", label: "Admin Assistant", icon: <Users size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "settings", label: "Settings", icon: <SettingsIcon size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller", "declarator"] },
  { id: "upload", label: "Upload", icon: <Camera size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller", "declarator", "supervisor_teller"] },
  { id: "feed", label: "Feed", icon: <FileText size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller", "declarator", "supervisor_teller"] },
  { id: "users", label: "People / Users", icon: <Users size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller", "declarator", "supervisor_teller"] },
  { id: "chat", label: "Chat / Messages", icon: <FileText size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller", "declarator", "supervisor_teller"] },
  { id: "key-performance-indicator", label: "Key Performance Indicator", icon: <BarChart3 size={16} />, allowedRoles: ["super_admin", "admin", "supervisor"] },
  { id: "betting-analytics", label: "Betting Analytics", icon: <TrendingUp size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "betting-event-report", label: "Betting Event Report", icon: <TrendingUp size={16} />, allowedRoles: ["super_admin", "admin", "supervisor"] },
  { id: "chicken-fight", label: "Chicken Fight", icon: <TrendingUp size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "declarator"] },
  { id: "chicken-fight-entries", label: "Chicken Fight Entries", icon: <SettingsIcon size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "declarator"] },
  { id: "live-cockfight-camera", label: "Live Cockfight Camera", icon: <Camera size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "declarator"] },
  { id: "betting-capture-screen", label: "Betting Capture Screen", icon: <Camera size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller", "declarator"] },
  { id: "stream-broadcaster", label: "Stream Broadcaster", icon: <Wifi size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller", "declarator"] },
  { id: "staff-performance", label: "Staff Performance", icon: <BarChart3 size={16} />, allowedRoles: ["super_admin","admin","supervisor"] },
  { id: "menu-config", label: "Menu Permissions", icon: <Shield size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "manage-sidebars", label: "Sidebar Control", icon: <SettingsIcon size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "live-map", label: "Live Map", icon: <MapPin size={16} />, allowedRoles: ["super_admin", "admin", "supervisor", "teller", "declarator"] },
  { id: "map-editor", label: "Map Editor", icon: <Map size={16} />, allowedRoles: ["super_admin", "admin", "declarator"] },
  { id: "teller-betting", label: "Teller Betting Data", icon: <TrendingUp size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "manage-betting", label: "Manage Betting Data", icon: <SettingsIcon size={16} />, allowedRoles: ["super_admin", "admin"] },
  { id: "teller-mappings", label: "Teller Mappings", icon: <Link size={16} />, allowedRoles: ["super_admin"] },
  // Legacy IDs for backward compatibility
  { id: "supervisor-reports", label: "Supervisor Reports (Legacy)", icon: <FileText size={16} /> },
  { id: "teller-report", label: "Teller Report (Legacy)", icon: <FileText size={16} /> },
  { id: "submit-report", label: "Submit Report (Legacy)", icon: <FileText size={16} /> },
  { id: "schedule", label: "Schedule/Rotation (Legacy)", icon: <Calendar size={16} /> },
  { id: "teller-of-month", label: "Teller of the Month (Legacy)", icon: <Users size={16} /> },
  // legacy 'users' entry intentionally removed to avoid duplicate ids (canonical 'users' is provided above)
  // 'approvals' alias intentionally removed — map to canonical 'user-approval' in SidebarLayout
];

const ROLES = [
  { id: "super_admin", label: "Super Admin", color: "red" },
  { id: "admin", label: "Admin", color: "blue" },
  { id: "supervisor", label: "Supervisor", color: "purple" },
  { id: "teller", label: "Teller", color: "green" },
  { id: "supervisor_teller", label: "Supervisor Teller", color: "indigo" },
  { id: "declarator", label: "Declarator", color: "orange" },
];

export default function SuperAdminMenuConfig() {
  const { settings, user } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState("admin");

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const opts = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await axios.get(`${getApiUrl()}/api/menu-permissions`, opts);
      const permMap = {};
      res.data.forEach((perm) => {
        // normalize legacy alias 'approvals' -> 'user-approval' and deduplicate
        const items = (perm.menuItems || []).map(id => id === 'approvals' ? 'user-approval' : id);
        permMap[perm.role] = Array.from(new Set(items));
      });
      setPermissions(permMap);
    } catch (err) {
      console.error("Failed to load menu permissions:", err);
      showToast({ type: "error", message: "Failed to load menu permissions" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMenuItem = (role, menuId) => {
    setPermissions((prev) => {
      const roleMenus = prev[role] || [];
      const updated = roleMenus.includes(menuId)
        ? roleMenus.filter((id) => id !== menuId)
        : [...roleMenus, menuId];
      return { ...prev, [role]: updated };
    });
  };

  // Move a selected item to the first position (index 0)
  const handleMakeFirst = (role, menuId) => {
    setPermissions((prev) => {
      const roleMenus = prev[role] || [];
      // If not selected yet, add then move to front
      const exists = roleMenus.includes(menuId);
      const without = roleMenus.filter((id) => id !== menuId);
      const updated = [menuId, ...(exists ? without : roleMenus)];
      return { ...prev, [role]: updated };
    });
  };

  const handleSelectAll = (role) => {
    setPermissions((prev) => ({
      ...prev,
      [role]: AVAILABLE_MENU_ITEMS.map((item) => item.id),
    }));
  };

  const handleDeselectAll = (role) => {
    setPermissions((prev) => ({
      ...prev,
      [role]: [],
    }));
  };

  const handleSave = async (role) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const opts = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await axios.put(`${getApiUrl()}/api/menu-permissions/${role}`, {
        menuItems: permissions[role] || [],
        updatedBy: user?.username || "super_admin",
      }, opts);
      showToast({ type: "success", message: `Saved menu permissions for ${role}` });
    } catch (err) {
      console.error("Failed to save menu permissions:", err);
      if (err?.response?.status === 401) {
        showToast({ type: "error", message: "Unauthorized — you must be signed in as super_admin to change menu permissions." });
      } else {
        showToast({ type: "error", message: "Failed to save menu permissions" });
      }
    } finally {
      setSaving(false);
    }
  };

  // Drag & Drop reordering for selected items
  const handleDragStart = (e, role, menuId) => {
    try { e.dataTransfer.setData('text/plain', menuId); } catch {}
  };

  const handleDrop = (e, role, targetId) => {
    e.preventDefault();
    let draggedId = '';
    try { draggedId = e.dataTransfer.getData('text/plain'); } catch {}
    if (!draggedId || draggedId === targetId) return;
    setPermissions((prev) => {
      const current = prev[role] || [];
      const from = current.indexOf(draggedId);
      const to = current.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      const next = current.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...prev, [role]: next };
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const opts = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      for (const role of ROLES) {
        await axios.put(`${getApiUrl()}/api/menu-permissions/${role.id}`, {
          menuItems: permissions[role.id] || [],
          updatedBy: user?.username || "super_admin",
        }, opts);
      }
      showToast({ type: "success", message: "Saved all menu permissions" });
    } catch (err) {
      console.error("Failed to save all permissions:", err);
      if (err?.response?.status === 401) {
        showToast({ type: "error", message: "Unauthorized — must be signed in as super_admin to save all role permissions." });
      } else {
        showToast({ type: "error", message: "Failed to save all permissions" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleInitializeDefaults = async () => {
    if (!window.confirm("Reset all roles to default menu permissions?")) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const opts = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await axios.post(`${getApiUrl()}/api/menu-permissions/initialize`, {}, opts);
      showToast({ type: "success", message: "Initialized default permissions" });
      fetchPermissions();
    } catch (err) {
      console.error("Failed to initialize defaults:", err);
      showToast({ type: "error", message: "Failed to initialize defaults" });
    } finally {
      setSaving(false);
    }
  };

  const roleMenus = permissions[selectedRole] || [];

  return (
    <div className={`min-h-screen p-6 ${dark ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-500" />
            <div>
              <h1 className="text-2xl font-bold">Menu Permissions Manager</h1>
              <p className="text-sm text-gray-500">Configure sidebar menu items for each role</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={fetchPermissions}
              disabled={loading}
              className={`px-4 py-2 rounded flex items-center gap-2 ${
                dark ? "bg-gray-700 hover:bg-gray-600" : "bg-white hover:bg-gray-50"
              } border ${dark ? "border-gray-600" : "border-gray-300"}`}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={handleInitializeDefaults}
              disabled={saving}
              className="px-4 py-2 rounded flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              <RefreshCw size={16} />
              Reset to Defaults
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded border bg-gray-50 dark:bg-gray-700 text-sm">
              <label className="text-xs mr-2">Enforce explicit menu permissions for Super Admin</label>
              <input
                type="checkbox"
                checked={localStorage.getItem('superAdminStrict') === 'true'}
                onChange={(e) => {
                  const value = e.target.checked ? 'true' : 'false';
                  localStorage.setItem('superAdminStrict', value);
                  // notify user
                  showToast({ type: 'info', message: `super_admin strict mode ${e.target.checked ? 'enabled' : 'disabled'}` });
                  // trigger a global change by emitting an update via socket (best-effort)
                  try { window.location.reload(); } catch (err) { /* ok */ }
                }}
                className="h-4 w-4"
              />
            </div>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-4 py-2 rounded flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save All Roles"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
            <p>Loading menu permissions...</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Role Selector */}
            <div className={`rounded-lg p-4 ${dark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
              <h2 className="text-lg font-semibold mb-3">Select Role</h2>
              <div className="space-y-2">
                {ROLES.map((role) => {
                  const count = (permissions[role.id] || []).length;
                  return (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className={`w-full text-left px-4 py-3 rounded flex items-center justify-between transition ${
                        selectedRole === role.id
                          ? `bg-${role.color}-600 text-white`
                          : dark
                          ? "bg-gray-700 hover:bg-gray-600"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      <span className="font-medium">{role.label}</span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          selectedRole === role.id ? "bg-white/20" : dark ? "bg-gray-600" : "bg-gray-300"
                        }`}
                      >
                        {count} items
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Menu Items Configuration */}
            <div className={`lg:col-span-2 rounded-lg p-4 ${dark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  Menu Items for <span className="text-indigo-500">{ROLES.find((r) => r.id === selectedRole)?.label}</span>
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSelectAll(selectedRole)}
                    className={`px-3 py-1 text-sm rounded ${dark ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"}`}
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => handleDeselectAll(selectedRole)}
                    className={`px-3 py-1 text-sm rounded ${dark ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"}`}
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={() => handleSave(selectedRole)}
                    disabled={saving}
                    className="px-3 py-1 text-sm rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Save size={14} className="inline mr-1" />
                    Save
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {AVAILABLE_MENU_ITEMS.map((item) => {
                  const idx = roleMenus.indexOf(item.id);
                  const isChecked = idx !== -1;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleToggleMenuItem(selectedRole, item.id)}
                      className={`flex items-center gap-3 p-3 rounded border transition ${
                        isChecked
                          ? "bg-indigo-50 border-indigo-500 dark:bg-indigo-900/30"
                          : dark
                          ? "bg-gray-700 border-gray-600 hover:bg-gray-600"
                          : "bg-gray-50 border-gray-300 hover:bg-gray-100"
                      }`}
                      draggable={isChecked}
                      onDragStart={(e) => isChecked && handleDragStart(e, selectedRole, item.id)}
                      onDragOver={(e) => isChecked && e.preventDefault()}
                      onDrop={(e) => handleDrop(e, selectedRole, item.id)}
                    >
                      <div className="relative flex-shrink-0">
                        {isChecked ? (
                          <CheckSquare size={20} className="text-indigo-600" />
                        ) : (
                          <Square size={20} className="text-gray-400" />
                        )}
                        {isChecked && (
                          <span className={`absolute -top-2 -right-2 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${
                            dark ? "bg-indigo-600 text-white" : "bg-indigo-500 text-white"
                          }`}>
                            {idx + 1}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-1 text-left">
                        {item.icon}
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      {isChecked && idx > 0 && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMakeFirst(selectedRole, item.id);
                          }}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                            dark ? "border-indigo-500 text-indigo-300 hover:bg-indigo-900/40" : "border-indigo-500 text-indigo-700 hover:bg-indigo-50"
                          }`}
                          title="Make #1"
                        >
                          <ChevronsUp size={14} />
                          Make #1
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className={`mt-4 p-3 rounded ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                <p className="text-sm text-gray-500">
                  <strong>{roleMenus.length}</strong> menu items selected for {ROLES.find((r) => r.id === selectedRole)?.label}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============== ACCESS CONTROL TAB ============== */}
        {loading ? null : (
          <div className="mt-8 rounded-lg p-6" style={{ backgroundColor: dark ? '#1f2937' : '#ffffff', border: `1px solid ${dark ? '#374151' : '#e5e7eb'}` }}>
            <h2 className="text-lg font-semibold mb-4">Page Access Control by Role</h2>
            <p className="text-sm text-gray-500 mb-4">Choose which roles can access each page</p>
            
            <div className="grid lg:grid-cols-2 gap-6">
              {AVAILABLE_MENU_ITEMS.map((item) => (
                <div key={item.id} className={`p-4 rounded border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    {item.icon}
                    <h3 className="font-medium">{item.label}</h3>
                  </div>
                  <div className="space-y-2">
                    {ROLES.map((role) => {
                      const allowedRoles = item.allowedRoles || [];
                      const isChecked = allowedRoles.includes(role.id);
                      return (
                        <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              // This is view-only in this UI; backend enforces via SidebarLayout roles
                            }}
                            disabled
                            className="rounded"
                          />
                          <span className={`text-sm ${isChecked ? 'font-medium text-indigo-600' : 'text-gray-600'}`}>
                            {role.label} {isChecked && '✓'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className={`mt-4 p-3 rounded text-sm ${dark ? 'bg-blue-900/30 text-blue-200' : 'bg-blue-50 text-blue-700'}`}>
              <strong>Note:</strong> Role-based access is controlled via the menu item configuration in SidebarLayout.jsx and backend middleware. Adjust roles in the code to customize access per feature.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
