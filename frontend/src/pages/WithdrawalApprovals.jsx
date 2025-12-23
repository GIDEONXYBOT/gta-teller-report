import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { API_URL } from "../utils/apiConfig.js";
import { 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Clock,
  User,
  Calendar,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Wallet
} from "lucide-react";

const API = API_URL;

export default function WithdrawalApprovals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [filter, setFilter] = useState("pending"); // pending, approved, rejected, all
  const [loading, setLoading] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { settings, user } = useContext(SettingsContext);
  
  // For unwithdrawn payrolls section
  const [weekOffset, setWeekOffset] = useState(0);
  const [unwithdrawnPayrolls, setUnwithdrawnPayrolls] = useState([]);
  const [loadingUnwithdrawn, setLoadingUnwithdrawn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("amount"); // amount, name, count

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const endpoint = filter === "pending" 
        ? `${API}/api/payroll/withdrawals/pending`
        : `${API}/api/payroll/withdrawals`;
      
      const res = await axios.get(endpoint);
      let data = res.data.withdrawals || [];
      
      // Filter if not already filtered by endpoint
      if (filter !== "pending" && filter !== "all") {
        data = data.filter(w => w.status === filter);
      }
      
      setWithdrawals(data);
    } catch (err) {
      console.error("❌ Failed to fetch withdrawals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchWithdrawals, 30000);
    return () => clearInterval(interval);
  }, [filter]);
  
  // Fetch unwithdrawn payrolls for the selected week
  const fetchUnwithdrawnPayrolls = async () => {
    setLoadingUnwithdrawn(true);
    try {
      // Calculate week start and end
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - daysFromMonday + (weekOffset * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      // Fetch all payrolls
      const res = await axios.get(`${API}/api/payroll`);
      const allPayrolls = res.data?.payrolls || [];
      
      // Filter unwithdrawn payrolls in this week - normalize dates for comparison
      const unwithdrawn = allPayrolls.filter(p => {
        // Skip if already withdrawn
        if (p.withdrawn === true) return false;
        
        // Check if payroll is in the selected week
        const payrollDate = new Date(p.createdAt || p.date);
        // Normalize to compare only dates, not times
        const normalizedPayroll = new Date(payrollDate.getFullYear(), payrollDate.getMonth(), payrollDate.getDate());
        const normalizedStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
        const normalizedEnd = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());
        
        return normalizedPayroll >= normalizedStart && normalizedPayroll <= normalizedEnd;
      });
      
      console.log(`📊 Week: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);
      console.log(`📦 Total payrolls: ${allPayrolls.length}`);
      console.log(`🔍 Unwithdrawn in week: ${unwithdrawn.length}`);
      
      // Group by user
      const grouped = {};
      unwithdrawn.forEach(p => {
        const userId = p.user?._id || p.user;
        if (!grouped[userId]) {
          grouped[userId] = {
            userId,
            userName: p.user?.name || p.user?.username || 'Unknown',
            username: p.user?.username || 'unknown',
            payrolls: [],
            totalAmount: 0
          };
        }
        grouped[userId].payrolls.push(p);
        grouped[userId].totalAmount += Number(p.totalSalary) || 0;
      });
      
      const groupedArray = Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);
      console.log(`👥 Users with unwithdrawn payrolls: ${groupedArray.length}`);
      
      setUnwithdrawnPayrolls(groupedArray);
    } catch (err) {
      console.error("❌ Failed to fetch unwithdrawn payrolls:", err);
    } finally {
      setLoadingUnwithdrawn(false);
    }
  };
  
  useEffect(() => {
    fetchUnwithdrawnPayrolls();
  }, [weekOffset]);

  const handleApprove = async (withdrawalId) => {
    if (!confirm("Approve this withdrawal request?")) return;

    try {
      await axios.put(`${API}/api/payroll/withdrawals/${withdrawalId}/approve`, {
        adminId: user?._id
      });
      
      alert("✅ Withdrawal approved successfully!");
      fetchWithdrawals();
      setSelectedWithdrawal(null);
    } catch (err) {
      console.error("❌ Failed to approve withdrawal:", err);
      alert("Failed to approve withdrawal: " + (err.response?.data?.message || err.message));
    }
  };

  const handleReject = async (withdrawalId) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    if (!confirm("Reject this withdrawal request?")) return;

    try {
      await axios.put(`${API}/api/payroll/withdrawals/${withdrawalId}/reject`, {
        adminId: user?._id,
        reason: rejectionReason
      });
      
      alert("❌ Withdrawal rejected");
      fetchWithdrawals();
      setSelectedWithdrawal(null);
      setRejectionReason("");
    } catch (err) {
      console.error("❌ Failed to reject withdrawal:", err);
      alert("Failed to reject withdrawal: " + (err.response?.data?.message || err.message));
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
      approved: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
      rejected: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
    };

    const icons = {
      pending: <Clock className="w-4 h-4" />,
      approved: <CheckCircle className="w-4 h-4" />,
      rejected: <XCircle className="w-4 h-4" />,
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${styles[status]}`}>
        {icons[status]}
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div
      className="p-6 min-h-screen"
      style={{
        backgroundColor:
          settings?.theme?.mode === "dark"
            ? settings.theme.darkBg
            : settings?.theme?.lightBg,
        color:
          settings?.theme?.mode === "dark"
            ? settings.theme.darkFont
            : settings?.theme?.lightFont,
      }}
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
          Withdrawal Approvals
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Review and approve employee withdrawal requests
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["pending", "approved", "rejected", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Unwithdrawn Payrolls Section */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              Unwithdrawn Payrolls
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Employees who haven't withdrawn their salary for the selected week
            </p>
          </div>
          
          {/* Summary Stats */}
          {!loadingUnwithdrawn && unwithdrawnPayrolls.length > 0 && (
            <div className="flex gap-4 text-center">
              <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {unwithdrawnPayrolls.length}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Employees</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ₱{unwithdrawnPayrolls.reduce((sum, u) => sum + u.totalAmount, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Total Pending</div>
              </div>
            </div>
          )}
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="px-4 py-2 rounded-lg font-semibold flex items-center gap-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Week
          </button>

          <div className="text-center">
            <div className="font-bold text-lg">
              {(() => {
                const now = new Date();
                const dayOfWeek = now.getDay();
                const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - daysFromMonday + (weekOffset * 7));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                return `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
              })()}
            </div>
            {weekOffset === 0 && <span className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold">(Current Week)</span>}
            {weekOffset < 0 && <span className="text-sm text-gray-600 dark:text-gray-400">({Math.abs(weekOffset)} week{Math.abs(weekOffset) > 1 ? 's' : ''} ago)</span>}
            {weekOffset > 0 && <span className="text-sm text-gray-600 dark:text-gray-400">({weekOffset} week{weekOffset > 1 ? 's' : ''} ahead)</span>}
          </div>

          <button
            onClick={() => setWeekOffset(weekOffset + 1)}
            className="px-4 py-2 rounded-lg font-semibold flex items-center gap-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
          >
            Next Week
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loadingUnwithdrawn ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : unwithdrawnPayrolls.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p>All employees have withdrawn their salary for this week!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Search and Sort Controls */}
            <div className="flex gap-3 flex-wrap mb-4">
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="amount">Sort by Amount (High to Low)</option>
                <option value="amount-asc">Sort by Amount (Low to High)</option>
                <option value="name">Sort by Name (A-Z)</option>
                <option value="count">Sort by Payroll Count</option>
              </select>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {(() => {
                const filtered = unwithdrawnPayrolls.filter(item => 
                  item.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.username.toLowerCase().includes(searchQuery.toLowerCase())
                );
                return `${filtered.length} of ${unwithdrawnPayrolls.length} employee${unwithdrawnPayrolls.length !== 1 ? 's' : ''}`;
              })()} with unwithdrawn payroll
            </div>
            
            {unwithdrawnPayrolls
              .filter(item => 
                item.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.username.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .sort((a, b) => {
                if (sortBy === "amount") return b.totalAmount - a.totalAmount;
                if (sortBy === "amount-asc") return a.totalAmount - b.totalAmount;
                if (sortBy === "name") return a.userName.localeCompare(b.userName);
                if (sortBy === "count") return b.payrolls.length - a.payrolls.length;
                return 0;
              })
              .map((item, index) => (
                <div
                  key={item.userId}
                  className="relative border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="absolute -top-2 -left-2 bg-orange-600 text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
                    {index + 1}
                  </div>
                  <div className="flex justify-between items-start ml-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{item.userName}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">@{item.username}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded-full font-semibold">
                          {item.payrolls.length} payroll{item.payrolls.length !== 1 ? 's' : ''}
                        </span>
                        {item.payrolls.length > 1 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Avg: ₱{(item.totalAmount / item.payrolls.length).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        ₱{item.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Total Unwithdrawn</div>
                    </div>
                  </div>
                  <div className="mt-3 ml-4">
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Payroll Details:</div>
                    <div className="flex flex-wrap gap-2">
                      {item.payrolls
                        .sort((a, b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date))
                        .map((p, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600 hover:shadow-sm transition"
                          >
                            <div className="font-semibold text-gray-700 dark:text-gray-300">
                              {new Date(p.createdAt || p.date).toLocaleDateString()}
                            </div>
                            <div className="text-orange-600 dark:text-orange-400 font-bold">
                              ₱{Number(p.totalSalary || 0).toFixed(2)}
                            </div>
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Withdrawals List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading withdrawals...</p>
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">No {filter} withdrawal requests</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {withdrawals.map((withdrawal) => (
            <div
              key={withdrawal._id}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 border-indigo-500 cursor-pointer hover:shadow-lg transition"
              onClick={() => setSelectedWithdrawal(withdrawal)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="font-semibold">
                    {withdrawal.userId?.name || withdrawal.userId?.username}
                  </h3>
                </div>
                {getStatusBadge(withdrawal.status)}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    ₱{(withdrawal.amount || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Requested:</span>
                  <span className="text-xs">
                    {new Date(withdrawal.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {withdrawal.approvedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {withdrawal.status === "approved" ? "Approved" : "Rejected"}:
                    </span>
                    <span className="text-xs">
                      {new Date(withdrawal.approvedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Withdrawal Details</h2>
              <button
                onClick={() => {
                  setSelectedWithdrawal(null);
                  setRejectionReason("");
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Employee:</label>
                <p className="font-semibold">
                  {selectedWithdrawal.userId?.name || selectedWithdrawal.userId?.username}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Amount:</label>
                <p className="font-bold text-2xl text-green-600 dark:text-green-400">
                  ₱{(selectedWithdrawal.amount || 0).toLocaleString()}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Status:</label>
                <div className="mt-1">{getStatusBadge(selectedWithdrawal.status)}</div>
              </div>

              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Requested On:</label>
                <p>{new Date(selectedWithdrawal.createdAt).toLocaleString()}</p>
              </div>

              {selectedWithdrawal.weekRange && (
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Week Range:</label>
                  <p>{selectedWithdrawal.weekRange}</p>
                </div>
              )}

              {selectedWithdrawal.status === "rejected" && selectedWithdrawal.rejectionReason && (
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Rejection Reason:</label>
                  <p className="text-red-600 dark:text-red-400">{selectedWithdrawal.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {selectedWithdrawal.status === "pending" && (
              <div className="space-y-3">
                <button
                  onClick={() => handleApprove(selectedWithdrawal._id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  <CheckCircle className="w-5 h-5" />
                  Approve Withdrawal
                </button>

                <div>
                  <input
                    type="text"
                    placeholder="Reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-2 border rounded-lg mb-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <button
                    onClick={() => handleReject(selectedWithdrawal._id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject Withdrawal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
