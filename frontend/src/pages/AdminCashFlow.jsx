import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { API_URL } from "../utils/apiConfig";

const API = API_URL;

export default function AdminCashFlow() {
  const { settings } = useContext(SettingsContext);
  const theme = settings?.theme || {};
  const darkMode = settings?.theme?.mode === "dark";

  const [capital, setCapital] = useState("");
  const [cashFlow, setCashFlow] = useState(null);
  const [loading, setLoading] = useState(true);

  // Expense states
  const [expenses, setExpenses] = useState([]); // ✅ initialized as []
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Supplies");
  const [editing, setEditing] = useState(null);
  const [totalExpense, setTotalExpense] = useState(0);
  const [message, setMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  ); // default today

  // Fetch current cashflow capital
  useEffect(() => {
    const fetchCashFlow = async () => {
      try {
        const res = await axios.get(`${API}/api/cashflow`);
        setCashFlow(res.data);
      } catch (err) {
        console.error("❌ Failed to load cashflow:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCashFlow();
  }, []);

  // Save overall capital
  const saveCapital = async () => {
    try {
      const res = await axios.put(`${API}/api/cashflow`, {
        overallCapital: Number(capital),
      });
      alert("✅ Cashflow updated!");
      setCashFlow(res.data.data);
    } catch (err) {
      console.error("❌ Error updating capital:", err);
      alert("Failed to update capital");
    }
  };

  // Load expenses for selected date (filter client-side from generic /api/cashflow?date=YYYY-MM-DD)
  const loadExpenses = async (date = selectedDate) => {
    try {
      const res = await axios.get(`${API}/api/cashflow`, { params: { date } });
      const all = Array.isArray(res.data) ? res.data : [];
      const onlyExpenses = all.filter((e) => e.type === "expense");
      setExpenses(onlyExpenses);
      const total = onlyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      setTotalExpense(total);
    } catch (err) {
      console.error("❌ Failed to load expenses:", err?.response?.data || err.message);
      setExpenses([]);
      setTotalExpense(0);
    }
  };

  // Save or update expense
  const saveExpense = async () => {
    if (!description || !amount) {
      setMessage("Warning: Please fill in all fields.");
      return;
    }

    try {
      if (editing) {
        // Update existing expense using generic endpoint (PUT /api/cashflow/:id) per backend routes
        await axios.put(`${API}/api/cashflow/${editing._id}`, {
          type: "expense",
          description,
          amount: Number(amount),
          category,
          date: selectedDate,
        });
        setMessage("✅ Expense updated!");
      } else {
        // Create new expense (POST /api/cashflow)
        await axios.post(`${API}/api/cashflow`, {
          type: "expense",
          description,
          amount: Number(amount),
          category,
          date: selectedDate,
        });
        setMessage("✅ Expense added!");
      }

      setDescription("");
      setAmount("");
      setCategory("Supplies");
      setEditing(null);
      setTimeout(() => setMessage(""), 1500);
      loadExpenses();
    } catch (err) {
      console.error("❌ Error saving expense:", err);
      setMessage("❌ Failed to save expense.");
    }
  };

  // Edit expense
  const startEdit = (exp) => {
    setEditing(exp);
    setDescription(exp.description);
    setAmount(exp.amount);
    setCategory(exp.category);
  };

  // Delete expense
  const deleteExpense = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await axios.delete(`${API}/api/cashflow/${id}`);
      loadExpenses();
    } catch (err) {
      console.error("❌ Error deleting expense:", err);
    }
  };

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div
      className="p-6 min-h-screen"
      style={{
        backgroundColor: darkMode ? theme.darkBg : theme.lightBg,
        color: darkMode ? theme.darkFont : theme.lightFont,
      }}
    >
      <h1 className="text-2xl font-bold mb-4">💵 Cash Flow Management</h1>

      {/* ---- CAPITAL SECTION ---- */}
      <div className="space-y-4 max-w-md mb-8">
        <label className="block">
          <span className="text-sm font-medium">Overall Capital</span>
          <input
            type="number"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            placeholder={cashFlow?.overallCapital || "Enter capital"}
            className="mt-1 w-full border rounded-md p-2"
            style={{
              backgroundColor: darkMode ? theme.darkBg : "#fff",
              color: darkMode ? theme.darkFont : "#111",
              borderColor: darkMode ? "#374151" : "#d1d5db",
            }}
          />
        </label>

        <button
          onClick={saveCapital}
          className="px-4 py-2 rounded-md"
          style={{
            backgroundColor: darkMode ? theme.darkFont : "#4f46e5",
            color: darkMode ? theme.darkBg : "#fff",
          }}
        >
          💾 Save Capital
        </button>

        {cashFlow && (
          <div
            className="mt-4 text-sm"
            style={{ color: darkMode ? theme.darkFont : "#374151" }}
          >
            <p>
              🪙 <strong>Last Updated:</strong>{" "}
              {new Date(cashFlow.lastUpdated).toLocaleString()}
            </p>
            <p>
              💰 <strong>Current Capital:</strong> ₱
              {(cashFlow.overallCapital || 0).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* ---- EXPENSE SECTION ---- */}
      <div
        className="p-5 rounded-xl shadow mb-6"
        style={{
          backgroundColor: darkMode ? "#0b1220" : "#fff",
          borderColor: darkMode ? "#1f2937" : "#e5e7eb",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            {editing ? "✏️ Edit Expense" : "➕ Add Expense"}
          </h2>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded p-2 text-sm"
            style={{
              backgroundColor: darkMode ? theme.darkBg : "#fff",
              color: darkMode ? theme.darkFont : "#111",
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border p-2 rounded w-40"
            style={{
              backgroundColor: darkMode ? theme.darkBg : "#fff",
              color: darkMode ? theme.darkFont : "#111",
            }}
          >
            <option>Supplies</option>
            <option>Food</option>
            <option>Utilities</option>
            <option>Maintenance</option>
            <option>Miscellaneous</option>
          </select>

          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border p-2 rounded flex-1 min-w-[150px]"
            style={{
              backgroundColor: darkMode ? theme.darkBg : "#fff",
              color: darkMode ? theme.darkFont : "#111",
            }}
          />

          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border p-2 rounded w-40 text-right"
            style={{
              backgroundColor: darkMode ? theme.darkBg : "#fff",
              color: darkMode ? theme.darkFont : "#111",
            }}
          />

          <button
            onClick={saveExpense}
            className="px-4 py-2 rounded"
            style={{
              backgroundColor: darkMode ? theme.darkFont : "#2563eb",
              color: darkMode ? theme.darkBg : "#fff",
            }}
          >
            {editing ? "💾 Update" : "➕ Add"}
          </button>

          {editing && (
            <button
              onClick={() => {
                setEditing(null);
                setDescription("");
                setAmount("");
              }}
              className="px-4 py-2 rounded"
              style={{
                backgroundColor: darkMode ? "#374151" : "#9ca3af",
                color: darkMode ? "#fff" : "#111",
              }}
            >
              Cancel
            </button>
          )}
        </div>

        {message && <p className="mt-3 font-medium">{message}</p>}
      </div>

      {/* ---- EXPENSES TABLE ---- */}
      <div
        className="p-4 rounded-xl shadow"
        style={{
          backgroundColor: darkMode ? "#071026" : "#fff",
          color: darkMode ? theme.darkFont : "#111",
        }}
      >
        <h2 className="text-lg font-semibold mb-3">
          🧾 Expenses for {new Date(selectedDate).toLocaleDateString()}
        </h2>

        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr style={{ backgroundColor: darkMode ? "#0b1220" : "#f3f4f6" }}>
              <th className="p-2">Category</th>
              <th className="p-2">Description</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-right">Time</th>
              <th className="p-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(expenses) && expenses.length > 0 ? (
              expenses.map((exp) => (
                <tr key={exp._id} className="border-b">
                  <td className="p-2">{exp.category}</td>
                  <td className="p-2">{exp.description}</td>
                  <td className="p-2 text-right">
                    ₱{Number(exp.amount).toLocaleString()}
                  </td>
                  <td className="p-2 text-right">
                    {new Date(exp.date).toLocaleTimeString()}
                  </td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => startEdit(exp)}
                      className="text-blue-600 hover:underline mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteExpense(exp._id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center py-3">
                  No expenses recorded on this date.
                </td>
              </tr>
            )}
            <tr className="font-bold">
              <td colSpan="2" className="p-2 text-right">
                TOTAL
              </td>
              <td className="p-2 text-right text-indigo-600 text-lg">
                ₱{Number(totalExpense || 0).toLocaleString()}
              </td>
              <td colSpan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
