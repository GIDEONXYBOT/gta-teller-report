import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL;

export default function SupervisorHistory() {
  const [transactions, setTransactions] = useState([]);
  const [supervisor, setSupervisor] = useState(localStorage.getItem("username") || "Unknown");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/transactions/supervisor/${supervisor}`);
      setTransactions(res.data);
    } catch (err) {
      console.error("Error fetching history:", err);
      setError("Failed to load history. Check backend connection.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 fade-in">
      <div className="bg-white shadow-lg p-6 rounded-xl max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">📜 Transaction History</h1>
        <p className="text-gray-600 mb-4">Supervisor: {supervisor}</p>

        {error && <div className="text-red-500 mb-4">{error}</div>}

        <table className="w-full border border-gray-300 rounded">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 text-left">Teller</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx._id} className="border-t">
                <td className="p-2">{tx.teller}</td>
                <td className="p-2">{tx.type}</td>
                <td className="p-2 text-right">
                  ₱{tx.amount?.toLocaleString()}
                </td>
                <td className="p-2 text-sm text-gray-500">
                  {new Date(tx.date).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!transactions.length && (
          <p className="text-gray-500 text-center mt-4">No transactions yet.</p>
        )}
      </div>
    </div>
  );
}
