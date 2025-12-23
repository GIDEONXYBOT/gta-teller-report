import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { DollarSign, Plus, Save, Trash2 } from "lucide-react";
import { SettingsContext } from "../context/SettingsContext.jsx";
import { getApiUrl } from "../utils/apiConfig";
import { getGlobalSocket } from "../utils/globalSocket";

export default function AdminSalaryOver() {
  const { user } = useContext(SettingsContext);
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [systemBaseSalary, setSystemBaseSalary] = useState(0);
  const [form, setForm] = useState({
    userId: "",
    over: 0,
    deduction: 0,
    withdrawal: 0,
    total: 0,
  });
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // ✅ Fetch base salary from System Settings
  const fetchSystemSettings = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/settings`);
      setSystemBaseSalary(res.data?.baseSalary || 0);
    } catch (err) {
      console.error("❌ Failed to fetch system settings:", err);
    }
  };

  // ✅ Fetch users for dropdown
  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/admin/users`);
      setUsers(res.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch users:", err);
    }
  };

  // ✅ Fetch all salary data
  const fetchSalaries = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/payroll/month/${new Date().getMonth()}`);
      setSalaryRecords(res.data.payrolls || []);
    } catch (err) {
      console.error("❌ Error fetching salary data:", err);
    }
  };

  // ✅ Calculate total automatically
  useEffect(() => {
    const total =
      systemBaseSalary +
      (Number(form.over) || 0) -
      (Number(form.deduction) || 0) -
      (Number(form.withdrawal) || 0);

    setForm((prev) => ({ ...prev, total }));
  }, [form.over, form.deduction, form.withdrawal, systemBaseSalary]);

  // ✅ Socket listener
  useEffect(() => {
    fetchSystemSettings();
    fetchUsers();
    fetchSalaries();

    const socket = getGlobalSocket();
    if (socket) {
      socket.on("payrollUpdated", fetchSalaries);
      return () => socket.off("payrollUpdated", fetchSalaries);
    }
  }, []);

  // ✅ Handle form input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ Save salary record
  const handleSave = async () => {
    if (!form.userId) {
      alert("Please select a user");
      return;
    }

    const payload = {
      userId: form.userId,
      over: Number(form.over),
      deduction: Number(form.deduction),
      withdrawal: Number(form.withdrawal),
    };

    try {
      if (editingId) {
        await axios.put(`${getApiUrl()}/api/payroll/${editingId}`, payload);
      } else {
        await axios.post(`${getApiUrl()}/api/payroll`, payload);
      }

      setForm({
        userId: "",
        over: 0,
        deduction: 0,
        withdrawal: 0,
        total: 0,
      });
      setEditingId(null);
      fetchSalaries();
    } catch (err) {
      console.error("❌ Error saving salary:", err);
      alert("Failed to save salary record");
    }
  };

  // ✅ Edit salary record
  const handleEdit = (record) => {
    setEditingId(record._id);
    setForm({
      userId: record.userId,
      over: record.over,
      deduction: record.deduction,
      withdrawal: record.withdrawal,
      total: record.totalSalary,
    });
  };

  // ✅ Delete salary record
  const handleDelete = async (id) => {
    if (!confirm("Delete this record?")) return;
    try {
      await axios.delete(`${getApiUrl()}/api/payroll/${id}`);
      fetchSalaries();
    } catch (err) {
      console.error("❌ Error deleting salary:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
          <DollarSign className="w-6 h-6" /> Salary & Over Management
        </h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Base Salary: ₱{systemBaseSalary.toLocaleString()}
        </span>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            name="userId"
            value={form.userId}
            onChange={handleChange}
            className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200"
          >
            <option value="">Select Employee</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name || u.username}
              </option>
            ))}
          </select>

          <input
            name="over"
            type="number"
            placeholder="Over"
            value={form.over}
            onChange={handleChange}
            className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200"
          />
          <input
            name="deduction"
            type="number"
            placeholder="Deduction"
            value={form.deduction}
            onChange={handleChange}
            className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200"
          />
          <input
            name="withdrawal"
            type="number"
            placeholder="Withdrawal"
            value={form.withdrawal}
            onChange={handleChange}
            className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-200"
          />
        </div>

        <div className="flex justify-between items-center mt-3">
          <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
            Total: ₱{form.total.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
            >
              {editingId ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {editingId ? "Update" : "Add"}
            </button>
            {editingId && (
              <button
                onClick={() => {
                  setForm({
                    userId: "",
                    over: 0,
                    deduction: 0,
                    withdrawal: 0,
                    total: 0,
                  });
                  setEditingId(null);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Salary Table */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md overflow-x-auto">
        <h2 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-200">
          Salary Records
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <th className="p-2 text-left">Employee</th>
              <th className="p-2 text-left">Base</th>
              <th className="p-2 text-left">Over</th>
              <th className="p-2 text-left">Deduction</th>
              <th className="p-2 text-left">Withdrawal</th>
              <th className="p-2 text-left">Total</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {salaryRecords.length > 0 ? (
              salaryRecords.map((r) => (
                <tr
                  key={r._id}
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="p-2">{users.find((u) => u._id === r.userId)?.name || "N/A"}</td>
                  <td className="p-2">₱{r.baseSalary?.toLocaleString()}</td>
                  <td className="p-2 text-green-600">₱{r.over?.toLocaleString()}</td>
                  <td className="p-2 text-red-500">₱{r.deduction?.toLocaleString()}</td>
                  <td className="p-2 text-red-500">₱{r.withdrawal?.toLocaleString()}</td>
                  <td className="p-2 font-semibold text-indigo-600">₱{r.totalSalary?.toLocaleString()}</td>
                  <td className="p-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(r)}
                      className="text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(r._id)}
                      className="text-red-600 hover:underline"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center p-4 text-gray-500 dark:text-gray-400">
                  No salary records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
