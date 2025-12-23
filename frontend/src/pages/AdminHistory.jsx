import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useReactToPrint } from "react-to-print";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { API_URL } from "../utils/apiConfig";

const API_BASE = API_URL;

export default function AdminHistory() {
  const [archives, setArchives] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [filtered, setFiltered] = useState([]);
  const printRef = useRef();

  const fetchArchives = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/cashflow-archive`);
      setArchives(res.data);
      setFiltered(res.data);
    } catch (err) {
      console.error("❌ Error fetching archives:", err);
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    if (!date) {
      setFiltered(archives);
    } else {
      const target = date.toISOString().split("T")[0];
      setFiltered(
        archives.filter((a) =>
          a.date?.startsWith(target)
        )
      );
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: "RMI_Gideon_Daily_Archive",
  });

  useEffect(() => {
    fetchArchives();
  }, []);

  return (
    <div className="p-8 min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">📅 Daily Archive Reports</h2>
        <div className="flex items-center space-x-3">
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            placeholderText="Filter by date"
            className="border rounded-md p-2 dark:bg-gray-800 dark:border-gray-700"
          />
          <button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
          >
            🖨️ Print
          </button>
        </div>
      </div>

      <div ref={printRef} className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-indigo-100 dark:bg-gray-700">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Overall Capital</th>
              <th className="p-3 text-left">Starting Capital</th>
              <th className="p-3 text-left">Additional</th>
              <th className="p-3 text-left">Remittance</th>
              <th className="p-3 text-left">Revolving</th>
              <th className="p-3 text-left">Cashbox</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center p-6 text-gray-500">
                  No archived records found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r._id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-3">
                    {new Date(r.lastUpdated || r.date).toLocaleDateString("en-PH")}
                  </td>
                  <td className="p-3">₱{r.overallCapital?.toLocaleString() || 0}</td>
                  <td className="p-3">₱{r.startingCapital?.toLocaleString() || 0}</td>
                  <td className="p-3">₱{r.additional?.toLocaleString() || 0}</td>
                  <td className="p-3">₱{r.remittance?.toLocaleString() || 0}</td>
                  <td className="p-3 font-semibold text-green-600">
                    ₱{r.revolving?.toLocaleString() || 0}
                  </td>
                  <td className="p-3 font-semibold text-blue-600">
                    ₱{r.cashbox?.toLocaleString() || 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
