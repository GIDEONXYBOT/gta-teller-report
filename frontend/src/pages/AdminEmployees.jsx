import React, { useEffect, useState } from "react";
import axios from "axios";
import SidebarLayout from "../components/SidebarLayout.jsx";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  DollarSign, 
  Calendar,
  Users,
  Briefcase
} from "lucide-react";
import { API_URL } from "../utils/apiConfig.js";

const API = `${API_URL}/api`;

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    position: "Watcher",
    dailySalary: ""
  });

  const [payrollData, setPayrollData] = useState({
    amount: "",
    dateKey: new Date().toISOString().split("T")[0],
    notes: ""
  });

  const positions = ["Watcher", "Sub-watcher", "Assistant Admin", "Monton"];

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API}/staff`);
      setEmployees(res.data || []);
    } catch (err) {
      console.error("Error fetching employees:", err);
      showMessage("error", "Failed to load employees");
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 3000);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.name || !formData.position) {
        throw new Error("Name and position are required");
      }

      await axios.post(`${API}/staff`, {
        ...formData,
        dailySalary: Number(formData.dailySalary) || 0
      });

      showMessage("success", "Employee added successfully");
      setShowAddModal(false);
      setFormData({ name: "", position: "Watcher", dailySalary: "" });
      fetchEmployees();
    } catch (err) {
      showMessage("error", err.response?.data?.message || "Failed to add employee");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.put(`${API}/staff/${editingEmployee._id}`, {
        ...formData,
        dailySalary: Number(formData.dailySalary) || 0
      });

      showMessage("success", "Employee updated successfully");
      setEditingEmployee(null);
      setFormData({ name: "", position: "Watcher", dailySalary: "" });
      fetchEmployees();
    } catch (err) {
      showMessage("error", err.response?.data?.message || "Failed to update employee");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;

    try {
      await axios.delete(`${API}/staff/${id}`);
      showMessage("success", "Employee deleted successfully");
      fetchEmployees();
    } catch (err) {
      showMessage("error", "Failed to delete employee");
    }
  };

  const handleAddPayroll = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!payrollData.amount || !payrollData.dateKey) {
        throw new Error("Amount and date are required");
      }

      const user = JSON.parse(localStorage.getItem("mock-user") || "{}");

      await axios.post(`${API}/staff/${selectedEmployee._id}/payroll`, {
        ...payrollData,
        amount: Number(payrollData.amount),
        createdBy: user.username || "admin"
      });

      showMessage("success", "Payroll added successfully");
      setShowPayrollModal(false);
      setPayrollData({ amount: "", dateKey: new Date().toISOString().split("T")[0], notes: "" });
      setSelectedEmployee(null);
    } catch (err) {
      showMessage("error", err.response?.data?.message || "Failed to add payroll");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      position: employee.position,
      dailySalary: employee.dailySalary || ""
    });
    setShowAddModal(true);
  };

  const cancelEdit = () => {
    setEditingEmployee(null);
    setFormData({ name: "", position: "Watcher", dailySalary: "" });
    setShowAddModal(false);
  };

  const openPayrollModal = (employee) => {
    setSelectedEmployee(employee);
    setPayrollData({
      amount: employee.dailySalary || "",
      dateKey: new Date().toISOString().split("T")[0],
      notes: ""
    });
    setShowPayrollModal(true);
  };

  return (
    <SidebarLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 rounded-lg">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Employee Management</h1>
                <p className="text-gray-600">Manage staff and manual payroll</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Employee
            </button>
          </div>
        </div>

          {/* Message */}
          {message.text && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                message.type === "success"
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : "bg-red-100 text-red-800 border border-red-300"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Employees Table */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Position</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Daily Salary</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                        No employees found. Add your first employee to get started.
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-800">{emp.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
                            <Briefcase className="w-4 h-4" />
                            {emp.position}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-green-600">
                            ₱{emp.dailySalary?.toLocaleString() || "0"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              emp.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {emp.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openPayrollModal(emp)}
                              className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                              title="Add Payroll"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => startEdit(emp)}
                              className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp._id)}
                              className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        {/* Add/Edit Employee Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  {editingEmployee ? "Edit Employee" : "Add New Employee"}
                </h2>
                <button
                  onClick={cancelEdit}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={editingEmployee ? handleUpdateEmployee : handleAddEmployee}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Position *
                    </label>
                    <select
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      {positions.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Daily Salary
                    </label>
                    <input
                      type="number"
                      value={formData.dailySalary}
                      onChange={(e) => setFormData({ ...formData, dailySalary: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:opacity-50"
                  >
                    {loading ? "Saving..." : editingEmployee ? "Update" : "Add"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Payroll Modal */}
        {showPayrollModal && selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Add Payroll</h2>
                <button
                  onClick={() => {
                    setShowPayrollModal(false);
                    setSelectedEmployee(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-gray-600">Employee</p>
                <p className="text-lg font-bold text-gray-800">{selectedEmployee.name}</p>
                <p className="text-sm text-indigo-600">{selectedEmployee.position}</p>
              </div>

              <form onSubmit={handleAddPayroll}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Amount *
                    </label>
                    <input
                      type="number"
                      value={payrollData.amount}
                      onChange={(e) => setPayrollData({ ...payrollData, amount: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={payrollData.dateKey}
                      onChange={(e) => setPayrollData({ ...payrollData, dateKey: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={payrollData.notes}
                      onChange={(e) => setPayrollData({ ...payrollData, notes: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows="3"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPayrollModal(false);
                      setSelectedEmployee(null);
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
                  >
                    {loading ? "Adding..." : "Add Payroll"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
