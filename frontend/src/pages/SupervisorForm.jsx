import React, { useEffect, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import SidebarLayout from "../components/SidebarLayout.jsx";
import { AlertCircle, CheckCircle2, Loader2, DollarSign, SendHorizontal, PlusCircle } from "lucide-react";
import { API_URL } from "../utils/apiConfig";

const API = `${API_URL}/api`;

export default function SupervisorForm() {
  const location = useLocation();
  // location.pathname can be /supervisor or /supervisor/teller-report or /supervisor/report
  const section = location.pathname === "/supervisor" ? "dashboard" : location.pathname === "/supervisor/teller-report" ? "teller-report" : location.pathname === "/supervisor/report" ? "supervisor-report" : "dashboard";

  const [tellers, setTellers] = useState([]);
  const [selectedTeller, setSelectedTeller] = useState("");
  const [hasCapitalToday, setHasCapitalToday] = useState(false);
  const [startingCapital, setStartingCapital] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [availableTypes, setAvailableTypes] = useState([]);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [supervisorName, setSupervisorName] = useState(() => {
    // from demo login
    const u = JSON.parse(localStorage.getItem("mock-user") || "{}");
    return u.username || "Ana Supervisor";
  });

  // Fetch only tellers that are in today's teller management (active management records)
  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("mock-user") || "{}");
    const supervisorId = u._id || u.id; // supervisor's own id
    if (!supervisorId) {
      console.warn("⚠️ No supervisorId found in localStorage mock-user; teller list will be empty.");
      return;
    }
    const today = new Date();
    const dateKey = today.toISOString().slice(0,10); // YYYY-MM-DD
    axios.get(`${API}/teller-management/tellers?supervisorId=${supervisorId}&dateKey=${dateKey}`)
      .then(r => {
        const list = r.data || [];
        console.log("🗂️ Fetched teller management list (raw):", list);
        // We'll keep all management records; dropdown will filter to those who have capital >0
        setTellers(list);
      })
      .catch(err => {
        console.error("❌ Error fetching teller management list:", err);
      });
  }, []);

  const fetchAvailableTransactionTypes = async (tellerId) => {
    try {
      const response = await axios.get(`${API}/teller-management/${tellerId}/available-transactions`);
      setAvailableTypes(response.data.availableTypes);
      // Set first available type as default
      if (response.data.availableTypes.length > 0) {
        setTransactionType(response.data.availableTypes[0]);
      }
    } catch (err) {
      console.error("Failed to fetch available transaction types:", err);
    }
  };

  const checkCapital = async (tellerName) => {
    if (!tellerName) { 
      setHasCapitalToday(false);
      setAvailableTypes([]);
      return;
    }
    try {
      const res = await axios.get(`${API}/transactions/check-capital?teller=${encodeURIComponent(tellerName)}`);
      setHasCapitalToday(res.data?.exists || false);
      
      // Get the teller's ID from the tellers array
      const teller = tellers.find(t => t.name === tellerName);
      if (teller?._id) {
        await fetchAvailableTransactionTypes(teller._id);
      }
    } catch (err) {
      // backend may be missing — try safe fallback
      setHasCapitalToday(false);
      setAvailableTypes([]);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setIsLoading(true);
    
    try {
      if (!selectedTeller) {
        throw new Error("Please select a teller first");
      }

      // Get the teller's ID from the tellers array
      const teller = tellers.find(t => t.name === selectedTeller);
      if (!teller?._id) {
        throw new Error("Invalid teller selected");
      }

      // Validate amount
      const transactionAmount = !hasCapitalToday ? Number(startingCapital) : Number(amount);
      if (!transactionAmount || transactionAmount <= 0) {
        throw new Error("Please enter a valid amount greater than 0");
      }

      const payload = {
        supervisor: supervisorName,
        teller: selectedTeller,
        tellerId: teller._id,
        type: !hasCapitalToday ? "capital" : transactionType,
        amount: transactionAmount
      };

      const res = await axios.post(`${API}/transactions`, payload);
      
      // Success handling
      setMessage({ 
        type: "success", 
        text: `Transaction ${!hasCapitalToday ? 'capital' : transactionType} successfully processed` 
      });
      
      // Clear form
      setStartingCapital("");
      setAmount("");
      
      // Refresh teller status
      await checkCapital(selectedTeller);
      
    } catch (err) {
      console.error("Save error:", err);
      setMessage({ 
        type: "error", 
        text: err.message || "Failed to process transaction. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Supervisor report view (aggregated)
  const [reportData, setReportData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: "", text: "" });

  const fetchSupervisorReport = async () => {
    try {
      const res = await axios.get(`${API}/reports/supervisor/${encodeURIComponent(supervisorName)}?date=${selectedDate}`);
      setReportData(res.data || []);
    } catch {
      setReportData([]);
    }
  };

  const submitSupervisorReport = async () => {
    setIsSubmitting(true);
    setSubmitMessage({ type: "", text: "" });
    
    try {
      // Get supervisor ID from localStorage
      const user = JSON.parse(localStorage.getItem("mock-user") || "{}");
      
      if (!user._id) {
        throw new Error("Supervisor ID not found");
      }

      const res = await axios.post(`${API}/supervisor/submit-report`, {
        supervisorId: user._id,
        supervisorName: supervisorName
      });

      if (res.data.success) {
        setReportSubmitted(true);
        setSubmitMessage({ 
          type: "success", 
          text: "Report submitted successfully! Admin can now view your report." 
        });
      }
    } catch (err) {
      console.error("Submit error:", err);
      setSubmitMessage({ 
        type: "error", 
        text: err.response?.data?.message || "Failed to submit report. Please try again." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SidebarLayout role="supervisor">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Supervisor — {supervisorName}</h1>
          <p className="text-sm text-gray-500">Use the sidebar to switch between supervisor report and teller report views.</p>
        </header>

        {section === "dashboard" && (
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
            <h2 className="font-semibold mb-2">Quick Actions</h2>
            <p className="text-sm text-gray-500">Submit starting capital or additional/remittance for tellers below.</p>
          </div>
        )}

        {section === "teller-report" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200">
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Transaction Form</h2>
                <p className="text-sm text-gray-600">⚠️ This page is currently in view-only mode. Transaction submission is disabled.</p>
              </div>

              <div className="space-y-6 opacity-50 pointer-events-none">
                {/* Teller Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Select Teller</label>
                  <div className="relative">
                    <select 
                      value={selectedTeller} 
                      onChange={e => { setSelectedTeller(e.target.value); checkCapital(e.target.value); }} 
                      className="w-full border border-gray-300 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
                      disabled
                    >
                      <option value="">Choose a teller...</option>
                      {tellers.map(t => (
                        <option key={t._id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Transaction Fields */}
                {selectedTeller && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    {!hasCapitalToday ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-600 mb-3">
                          <AlertCircle size={16} />
                          <span>This teller needs starting capital</span>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Starting Capital Amount</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <DollarSign size={16} className="text-gray-400" />
                            </div>
                            <input 
                              type="number" 
                              value={startingCapital} 
                              onChange={e => setStartingCapital(e.target.value)}
                              className="pl-10 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Enter amount..."
                              disabled
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 mb-3">
                          <CheckCircle2 size={16} />
                          <span>Capital active - you can add or collect funds</span>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Transaction Type</label>
                          <div className="relative">
                            <select 
                              value={transactionType} 
                              onChange={e => setTransactionType(e.target.value)} 
                              className="w-full border border-gray-300 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
                              disabled
                            >
                              <option value="">Select type...</option>
                              {availableTypes.map(type => (
                                <option key={type} value={type}>
                                  {type === 'additional' ? '➕ Additional Capital' : 
                                   type === 'remittance' ? '💰 Remittance Collection' : 
                                   type.charAt(0).toUpperCase() + type.slice(1)}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Amount</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <DollarSign size={16} className="text-gray-400" />
                            </div>
                            <input 
                              type="number" 
                              value={amount} 
                              onChange={e => setAmount(e.target.value)}
                              className="pl-10 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Enter amount..."
                              disabled
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Button & Messages - Disabled */}
                {selectedTeller && (
                  <div className="pt-4">
                    <button 
                      type="button"
                      disabled
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-lg text-white font-medium bg-gray-400 cursor-not-allowed"
                    >
                      <span>Transaction Submission Disabled</span>
                    </button>

                    <div className="mt-3 p-3 rounded-lg text-sm bg-yellow-50 text-yellow-700 border border-yellow-200">
                      <span>⚠️ This feature is currently disabled for view-only access.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {section === "supervisor-report" && (
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
            <div className="flex gap-2 items-center mb-3">
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="border p-2 rounded" />
              <button onClick={fetchSupervisorReport} className="bg-indigo-600 text-white px-3 py-2 rounded">Load Report</button>
            </div>

            {!reportData.length ? <div className="text-gray-500">No data.</div> : (
              <>
                <table className="w-full text-sm mb-4">
                  <thead className="bg-gray-100"><tr><th className="p-2 border">Teller</th><th className="p-2 border text-right">Start</th><th className="p-2 border text-right">Add</th><th className="p-2 border text-right">Remit</th><th className="p-2 border text-right">Total</th></tr></thead>
                  <tbody>
                    {reportData.map((r,i)=>(
                      <tr key={i}><td className="p-2 border">{r.teller}</td><td className="p-2 border text-right">₱{r.startingCapital||0}</td><td className="p-2 border text-right">₱{r.additional||0}</td><td className="p-2 border text-right">₱{r.remittance||0}</td><td className="p-2 border text-right font-semibold">₱{r.total||0}</td></tr>
                    ))}
                  </tbody>
                </table>

                {/* Submit Report Button - Disabled */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-3">
                    <button
                      disabled
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-gray-400 cursor-not-allowed"
                    >
                      <span>Report Submission Disabled</span>
                    </button>

                    <span className="text-sm text-yellow-600 font-medium">
                      ⚠️ Report submission is currently disabled for view-only access
                    </span>
                  </div>

                  <div className="mt-3 p-3 rounded-lg text-sm bg-yellow-50 text-yellow-700 border border-yellow-200">
                    <span>This feature is currently disabled for view-only access.</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
