import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import {
  Search,
  RefreshCcw,
  CheckCircle,
  Printer,
  ClipboardList,
  Eye,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function TellerReportsSupervisor({ userRole = "supervisor" }) {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === "dark";

  const [tellers, setTellers] = useState([]);
  const [selectedTeller, setSelectedTeller] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const printRef = useRef();

  const fetchReports = async () => {
    try {
      const res = await axios.get(`${API}/api/teller-reports/by-supervisor/${user?._id}`);
      setTellers(res.data || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      showToast({ type: "error", message: "Failed to load teller reports" });
    }
  };

  useEffect(() => {
    if (user?._id) fetchReports();
  }, [user?._id]);

  const selectTeller = (teller) => {
    setSelectedTeller(teller);
    setSelectedReport(teller);
  };

  const handleVerify = async (tellerId) => {
    try {
      const res = await axios.put(`${API}/api/teller-reports/verify/${tellerId}`);
      showToast({ type: "success", message: res.data.message });
      fetchReports();
    } catch {
      showToast({ type: "error", message: "Failed to verify report" });
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Supervisor Teller Report - ${selectedReport?.tellerName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #000;
              padding: 20px;
              background: #fff;
            }
            h2, h3 {
              text-align: center;
              margin-bottom: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              border: 1px solid #000;
              padding: 6px;
              text-align: right;
              font-size: 13px;
            }
            th { background: #f0f0f0; text-align: center; }
            .summary { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .summary div { width: 24%; border: 1px solid #000; padding: 5px; text-align: center; }
            .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
            .signatures div { text-align: center; flex: 1; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const formatPeso = (num) =>
    "₱" + (Number(num) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });

  const filteredTellers = tellers
    .filter((t) => {
      if (filter === "pending") return !t.verified;
      if (filter === "verified") return t.verified;
      return true;
    })
    .filter((t) =>
      t.tellerName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div
      className={`flex flex-col md:flex-row h-full ${
        dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-800"
      }`}
    >
      {/* LEFT PANEL */}
      <div className="w-full md:w-1/3 border-r dark:border-gray-700 p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList size={18} /> Teller Reports
          </h2>
          <button
            onClick={fetchReports}
            className="p-1 rounded hover:bg-indigo-600 hover:text-white"
          >
            <RefreshCcw size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search teller..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-8 pr-3 py-2 text-sm rounded-md ${
              dark
                ? "bg-gray-800 text-gray-200 border border-gray-700"
                : "bg-gray-100 text-gray-800 border border-gray-300"
            }`}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex justify-between text-sm mb-4">
          {["all", "pending", "verified"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-center py-1 rounded-md mx-1 capitalize ${
                filter === f
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul className="space-y-2">
            {filteredTellers.map((teller) => (
              <li
                key={teller._id}
                onClick={() => selectTeller(teller)}
                className={`p-3 rounded-md cursor-pointer transition-all border ${
                  selectedTeller?._id === teller._id
                    ? "bg-indigo-600 text-white border-indigo-500"
                    : "hover:bg-indigo-100 dark:hover:bg-indigo-800 border-gray-700"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{teller.tellerName}</span>
                  {teller.verified ? (
                    <span className="text-green-400 text-xs font-semibold">Verified</span>
                  ) : (
                    <span className="text-red-400 text-xs font-semibold">Pending</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 p-6 overflow-y-auto">
        {selectedReport ? (
          <div ref={printRef} className="space-y-5">
            {/* HEADER */}
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Eye size={22} /> {selectedReport.tellerName}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md"
                >
                  <Printer size={16} /> Print
                </button>
                {!selectedReport.verified && (
                  <button
                    onClick={() => handleVerify(selectedReport.userId)}
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md"
                  >
                    <CheckCircle size={16} /> Verify
                  </button>
                )}
              </div>
            </div>

            {/* SUMMARY TOTALS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <SummaryCard label="Capital" value={formatPeso(selectedReport.baseCapital || 0)} />
              <SummaryCard label="Additional" value={formatPeso(selectedReport.additionalCapital || 0)} />
              <SummaryCard label="Remitted" value={formatPeso(selectedReport.totalRemittances || 0)} />
              <SummaryCard label="Remaining" value={formatPeso((selectedReport.baseCapital || 0) + (selectedReport.additionalCapital || 0) - (selectedReport.totalRemittances || 0))} />
            </div>

            {/* DENOMINATIONS TABLE */}
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full border-collapse border border-gray-700">
                <thead>
                  <tr className="bg-indigo-600 text-white text-sm">
                    <th className="border border-gray-700 px-3 py-2">Denomination</th>
                    <th className="border border-gray-700 px-3 py-2">Pieces</th>
                    <th className="border border-gray-700 px-3 py-2">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "₱1000", val: selectedReport.d1000 },
                    { label: "₱500", val: selectedReport.d500 },
                    { label: "₱200", val: selectedReport.d200 },
                    { label: "₱100", val: selectedReport.d100 },
                    { label: "₱50", val: selectedReport.d50 },
                    { label: "₱20", val: selectedReport.d20 },
                    { label: "Coins", val: selectedReport.coins },
                  ].map((d, i) => (
                    <tr key={i}>
                      <td className="border border-gray-700 px-3 py-2 text-left">{d.label}</td>
                      <td className="border border-gray-700 px-3 py-2 text-center">{d.val}</td>
                      <td className="border border-gray-700 px-3 py-2 text-right">
                        {formatPeso(
                          d.label === "Coins"
                            ? d.val
                            : parseInt(d.label.replace("₱", "")) * d.val
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center mt-10 text-gray-500">
            Select a teller to view their report.
          </div>
        )}
      </div>
    </div>
  );
}

// Summary Card
function SummaryCard({ label, value }) {
  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
