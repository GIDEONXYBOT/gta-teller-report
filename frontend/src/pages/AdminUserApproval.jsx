import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { CheckCircle, Edit3, Trash2, KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";

export default function AdminUserApproval() {
  const { settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const API_BASE = getApiUrl(); // Get fresh API URL
      const res = await axios.get(`${API_BASE}/api/admin/users`);
      setUsers(res.data || []);
    } catch (err) {
      console.error("❌ Fetch users error:", err);
      showToast({ type: "error", message: "Failed to fetch users." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    const socket = getGlobalSocket();
    if (socket) {
      socket.on("userUpdated", fetchUsers);
      socket.on("userDeleted", fetchUsers);
    }
    return () => {
      if (socket) {
        socket.off("userUpdated", fetchUsers);
        socket.off("userDeleted", fetchUsers);
      }
    };
  }, []);

  // ✅ Approve user
  const approveUser = async (id) => {
    try {
      await axios.put(`${getApiUrl()}/api/admin/approve-user/${id}`, { active: true });
      setUsers((prev) =>
        prev.map((u) =>
          u._id === id ? { ...u, active: true, status: "approved" } : u
        )
      );
      showToast({ type: "success", message: "User approved successfully!" });
      setTimeout(fetchUsers, 500);
    } catch (err) {
      console.error(err);
      showToast({ type: "error", message: "Failed to approve user." });
    }
  };

  // ✅ Deactivate user
  const deactivateUser = async (id) => {
    try {
      await axios.put(`${getApiUrl()}/api/admin/approve-user/${id}`, { active: false });
      setUsers((prev) =>
        prev.map((u) =>
          u._id === id ? { ...u, active: false, status: "pending" } : u
        )
      );
      showToast({ type: "success", message: "User deactivated successfully!" });
      setTimeout(fetchUsers, 500);
    } catch (err) {
      console.error(err);
      showToast({ type: "error", message: "Failed to deactivate user." });
    }
  };

  // ✅ Reset password
  const resetPassword = async (id) => {
    const confirmReset = window.confirm(
      "Reset this user's password to default (12345)?"
    );
    if (!confirmReset) return;
    try {
      await axios.put(`${getApiUrl()}/api/admin/update-user/${id}`, {
        password: "12345",
      });
      showToast({
        type: "success",
        message: "Password reset successfully! New password: 12345",
      });
    } catch (err) {
      console.error(err);
      showToast({ type: "error", message: "Failed to reset password." });
    }
  };

  // ✅ Delete user
  const deleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await axios.delete(`${getApiUrl()}/api/admin/user/${id}`);
      setUsers((prev) => prev.filter((u) => u._id !== id));
      showToast({ type: "success", message: "User deleted successfully!" });
    } catch (err) {
      console.error(err);
      showToast({ type: "error", message: "Failed to delete user." });
    }
  };

  // ✅ Open edit modal
  const openEdit = (user) => {
    setEditingUser(user);
    setEditRole(user.role || "");
    setEditName(user.name || "");
    setEditUsername(user.username || "");
    setEditPassword(user.plainTextPassword || ""); // ✅ Show existing plain text password
  };

  // ✅ Save edits
  const saveEdit = async () => {
    if (!editingUser) return;
    try {
      const payload = {
        role: editRole,
        name: editName,
        username: editUsername,
      };
      if (editPassword.trim()) payload.password = editPassword;

      await axios.put(`${getApiUrl()}/api/admin/update-user/${editingUser._id}`, payload);

      setEditingUser(null);
      setEditPassword("");
      await fetchUsers();
      showToast({ type: "success", message: "User updated successfully!" });
    } catch (err) {
      console.error("❌ Edit user error:", err);
      showToast({ type: "error", message: "Failed to update user." });
    }
  };

  // 🔎 Filter + Search (includes ID search)
  const filteredUsers = users.filter((u) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      u.username?.toLowerCase().includes(searchLower) ||
      u.name?.toLowerCase().includes(searchLower) ||
      u._id?.toLowerCase().includes(searchLower); // ✅ Added ID search
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "approved"
        ? u.active || u.status === "approved"
        : filter === "pending"
        ? !u.active && (u.status === "pending" || !u.status)
        : filter === "deactivated"
        ? u.active === false && u.status !== "approved"
        : true;
    return matchesSearch && matchesFilter;
  });

  return (
    <div
      className={`p-6 transition-all ${
        dark ? "bg-gray-950 text-gray-100" : "bg-gray-100 text-gray-800"
      }`}
    >
      {/* Header + Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold">👥 User Management</h1>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search by name, username, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border rounded-md bg-transparent"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border rounded-md bg-transparent"
          >
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin h-8 w-8 text-indigo-500" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className={`min-w-full border rounded-lg ${
              dark ? "border-gray-700" : "border-gray-300"
            }`}
          >
            <thead
              className={`${
                dark ? "bg-gray-800 text-gray-200" : "bg-gray-200 text-gray-700"
              }`}
            >
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Password</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user._id}
                  className={`border-t ${
                    dark ? "border-gray-700" : "border-gray-300"
                  } hover:bg-indigo-50 dark:hover:bg-gray-800`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{user._id}</td>
                  <td className="px-4 py-3">{user.name || "—"}</td>
                  <td className="px-4 py-3">{user.username}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {user.plainTextPassword || "••••••"}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">{user.role}</td>
                  <td className="px-4 py-3">
                    {user.active || user.status === "approved" ? (
                      <span className="text-green-500 font-medium flex items-center gap-1">
                        <CheckCircle size={16} /> Approved
                      </span>
                    ) : (
                      <span className="text-yellow-500 font-medium">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <button
                      onClick={() => resetPassword(user._id)}
                      className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                      title="Reset Password"
                    >
                      <KeyRound size={16} />
                    </button>
                    {user.active || user.status === "approved" ? (
                      <button
                        onClick={() => deactivateUser(user._id)}
                        className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => approveUser(user._id)}
                        className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(user)}
                      className="p-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded"
                      title="Edit"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => deleteUser(user._id)}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-6 text-gray-500 dark:text-gray-400"
                  >
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 🧩 Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div
            className={`p-6 rounded-lg w-96 ${
              dark ? "bg-gray-900 text-white" : "bg-white text-gray-900"
            }`}
          >
            <h2 className="text-lg font-semibold mb-4">
              ✏️ Edit User – {editingUser.username}
            </h2>

            <div className="space-y-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full Name"
                className="w-full p-2 border rounded-md bg-transparent"
              />
              <input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Username"
                className="w-full p-2 border rounded-md bg-transparent"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full p-2 border rounded-md bg-transparent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full p-2 border rounded-md bg-transparent"
              >
                <option value="">Select Role</option>
                <option value="admin">Admin</option>
                <option value="supervisor">Supervisor</option>
                <option value="supervisor_teller">Supervisor/Teller</option>
                <option value="head_watcher">Head Watcher</option>
                <option value="sub_watcher">Sub Watcher</option>
                <option value="declarator">Declarator</option>
                <option value="teller">Teller</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
