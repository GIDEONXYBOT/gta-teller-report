import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

const BettingAnalytics = () => {
  const { isDarkMode } = useContext(SettingsContext);
  const { addToast } = useToast();
  const API = getApiUrl();

  const [bettingData, setBettingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("week"); // week, month, all
  const [selectedTeller, setSelectedTeller] = useState("all");
  const [analyticsData, setAnalyticsData] = useState(null);

  // Fetch betting data and calculate analytics
  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, selectedTeller]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("authToken");
      const response = await axios.get(`${API}/api/betting-data/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        const data = response.data.data;
        setBettingData(data);
        calculateAnalytics(data);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to fetch analytics";
      setError(errorMsg);
      addToast(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (data) => {
    if (!data || data.length === 0) {
      setAnalyticsData(null);
      return;
    }

    // Filter data based on selected teller
    let filteredData = data;
    if (selectedTeller !== "all") {
      filteredData = data.filter((d) => d.username === selectedTeller);
    }

    // Calculate metrics
    const totalBets = filteredData.reduce((sum, d) => sum + (d.totalBet || 0), 0);
    const avgMWBet = filteredData.length > 0
      ? (filteredData.reduce((sum, d) => sum + (d.mwBetPercent || 0), 0) / filteredData.length).toFixed(2)
      : 0;
    const avgBetPerTeller = filteredData.length > 0
      ? (totalBets / filteredData.length).toFixed(0)
      : 0;
    const highestBetter = filteredData.length > 0
      ? filteredData.reduce((max, d) => (d.totalBet > max.totalBet ? d : max), filteredData[0])
      : null;
    const lowestBetter = filteredData.length > 0
      ? filteredData.reduce((min, d) => (d.totalBet < min.totalBet ? d : min), filteredData[0])
      : null;

    // Top performers
    const topPerformers = [...data]
      .sort((a, b) => b.totalBet - a.totalBet)
      .slice(0, 5);

    // M/W Bet trends
    const mwBetTrends = [...data]
      .sort((a, b) => b.mwBetPercent - a.mwBetPercent)
      .slice(0, 5);

    setAnalyticsData({
      totalBets,
      avgMWBet,
      avgBetPerTeller,
      highestBetter,
      lowestBetter,
      topPerformers,
      mwBetTrends,
      tellerCount: new Set(data.map((d) => d.username)).size,
      dataPoints: filteredData.length,
    });
  };

  const exportAnalytics = () => {
    if (!analyticsData) {
      addToast("No data to export", "error");
      return;
    }

    try {
      let csvContent = "Betting Analytics Report\n";
      csvContent += `Generated: ${new Date().toLocaleString()}\n`;
      csvContent += `Date Range: ${dateRange}\n`;
      csvContent += `Selected Teller: ${selectedTeller === "all" ? "All" : selectedTeller}\n\n`;

      csvContent += "Key Metrics\n";
      csvContent += `Total Bets,${analyticsData.totalBets}\n`;
      csvContent += `Average M/W Bet %,${analyticsData.avgMWBet}%\n`;
      csvContent += `Average Bet Per Teller,${analyticsData.avgBetPerTeller}\n`;
      csvContent += `Total Tellers,${analyticsData.tellerCount}\n\n`;

      csvContent += "Top Performers\n";
      csvContent += "Username,Total Bet,M/W Bet %\n";
      analyticsData.topPerformers.forEach((t) => {
        csvContent += `${t.username},${t.totalBet},${t.mwBetPercent}\n`;
      });

      csvContent += "\nTop M/W Bet %\n";
      csvContent += "Username,Total Bet,M/W Bet %\n";
      analyticsData.mwBetTrends.forEach((t) => {
        csvContent += `${t.username},${t.totalBet},${t.mwBetPercent}\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `betting-analytics-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      addToast("Analytics exported successfully", "success");
    } catch (err) {
      addToast("Failed to export analytics", "error");
    }
  };

  const MetricCard = ({ title, value, icon: Icon, trend, subtitle }) => (
    <div
      className={`p-6 rounded-lg border ${
        isDarkMode
          ? "bg-gray-800 border-gray-700"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
            {title}
          </p>
          <p className={`text-2xl font-bold mt-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-xs mt-1 ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${isDarkMode ? "bg-gray-700" : "bg-gray-100"}`}>
          <Icon size={24} className="text-blue-500" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-2">
          {trend > 0 ? (
            <TrendingUp size={16} className="text-green-500" />
          ) : (
            <TrendingDown size={16} className="text-red-500" />
          )}
          <span className={trend > 0 ? "text-green-500" : "text-red-500"}>
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        </div>
      )}
    </div>
  );

  const TellerComparison = ({ data, type = "topPerformers" }) => (
    <div
      className={`p-6 rounded-lg border ${
        isDarkMode
          ? "bg-gray-800 border-gray-700"
          : "bg-white border-gray-200"
      }`}
    >
      <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
        {type === "topPerformers" ? "Top 5 Performers" : "Top 5 by M/W Bet %"}
      </h3>
      <div className="space-y-3">
        {data && data.length > 0 ? (
          data.map((teller, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg flex items-center justify-between ${
                isDarkMode ? "bg-gray-700" : "bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    idx === 0
                      ? "bg-yellow-500"
                      : idx === 1
                      ? "bg-gray-400"
                      : idx === 2
                      ? "bg-orange-600"
                      : "bg-blue-500"
                  }`}
                >
                  {idx + 1}
                </div>
                <div>
                  <p className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                    {teller.username}
                  </p>
                  <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    Total: ₱{teller.totalBet?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-blue-500">{teller.mwBetPercent}%</p>
                <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
                  M/W Bet
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>No data available</p>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen p-8 ${
        isDarkMode ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      {/* Header */}
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
          Betting Analytics
        </h1>
        <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
          Real-time insights and trends in teller betting activity
        </p>
      </div>

      {/* Controls */}
      <div className={`p-6 rounded-lg border mb-8 ${
        isDarkMode
          ? "bg-gray-800 border-gray-700"
          : "bg-white border-gray-200"
      }`}>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <label className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Date Range:
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className={`px-3 py-2 rounded-lg border ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              }`}
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Teller:
            </label>
            <select
              value={selectedTeller}
              onChange={(e) => setSelectedTeller(e.target.value)}
              className={`px-3 py-2 rounded-lg border ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              }`}
            >
              <option value="all">All Tellers</option>
              {bettingData && bettingData.map((d) => (
                <option key={d.username} value={d.username}>
                  {d.username}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 ml-auto">
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={exportAnalytics}
              className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white"
              title="Export as CSV"
            >
              <Download size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-8 p-4 rounded-lg bg-red-100 border border-red-300 flex items-gap-2">
          <AlertCircle size={20} className="text-red-600 mt-0.5" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin">
            <RefreshCw size={32} className="text-blue-500" />
          </div>
          <p className={`mt-4 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
            Loading analytics data...
          </p>
        </div>
      )}

      {/* Analytics Content */}
      {!loading && analyticsData && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Total Bets"
              value={`₱${analyticsData.totalBets.toLocaleString()}`}
              icon={TrendingUp}
              subtitle={`${analyticsData.dataPoints} data points`}
            />
            <MetricCard
              title="Avg M/W Bet %"
              value={`${analyticsData.avgMWBet}%`}
              icon={BarChart3}
              subtitle="Across all tellers"
            />
            <MetricCard
              title="Avg Bet Per Teller"
              value={`₱${analyticsData.avgBetPerTeller.toLocaleString()}`}
              icon={Calendar}
              subtitle={`${analyticsData.tellerCount} tellers`}
            />
            <MetricCard
              title="Bet Range"
              value={`₱${(analyticsData.highestBetter?.totalBet - analyticsData.lowestBetter?.totalBet).toLocaleString()}`}
              icon={TrendingDown}
              subtitle={`${analyticsData.lowestBetter?.username} to ${analyticsData.highestBetter?.username}`}
            />
          </div>

          {/* Detailed Comparisons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <TellerComparison
              data={analyticsData.topPerformers}
              type="topPerformers"
            />
            <TellerComparison
              data={analyticsData.mwBetTrends}
              type="mwBetTrends"
            />
          </div>

          {/* Highest and Lowest Bettors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <div
              className={`p-6 rounded-lg border ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Highest Bettor
              </h3>
              {analyticsData.highestBetter && (
                <div className={`p-4 rounded-lg ${isDarkMode ? "bg-gray-700" : "bg-green-50"}`}>
                  <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    Username
                  </p>
                  <p className={`text-2xl font-bold ${isDarkMode ? "text-green-400" : "text-green-600"}`}>
                    {analyticsData.highestBetter.username}
                  </p>
                  <p className={`text-sm mt-2 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    Total Bets: ₱{analyticsData.highestBetter.totalBet?.toLocaleString()}
                  </p>
                  <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    M/W Bet %: {analyticsData.highestBetter.mwBetPercent}%
                  </p>
                </div>
              )}
            </div>

            <div
              className={`p-6 rounded-lg border ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Lowest Bettor
              </h3>
              {analyticsData.lowestBetter && (
                <div className={`p-4 rounded-lg ${isDarkMode ? "bg-gray-700" : "bg-red-50"}`}>
                  <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    Username
                  </p>
                  <p className={`text-2xl font-bold ${isDarkMode ? "text-red-400" : "text-red-600"}`}>
                    {analyticsData.lowestBetter.username}
                  </p>
                  <p className={`text-sm mt-2 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    Total Bets: ₱{analyticsData.lowestBetter.totalBet?.toLocaleString()}
                  </p>
                  <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    M/W Bet %: {analyticsData.lowestBetter.mwBetPercent}%
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && !analyticsData && !error && (
        <div className="text-center py-12">
          <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
          <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            No betting data available yet
          </p>
        </div>
      )}
    </div>
  );
};

export default BettingAnalytics;
