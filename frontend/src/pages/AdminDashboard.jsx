import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { API_URL } from "../utils/apiConfig.js";
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Activity,
  UserCheck,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";

const API = API_URL;

export default function AdminDashboard() {
  const [data, setData] = useState({
    overallCapital: 0,
    startingCapital: 0,
    additional: 0,
    remittance: 0,
  });
  const [activeTellers, setActiveTellers] = useState([]);
  const [activeSupervisors, setActiveSupervisors] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingApprovals: 0,
    todayReports: 0,
    totalPayroll: 0
  });
  const { settings } = useContext(SettingsContext);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/api/cashflow`);
      setData(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch dashboard data:", err);
    }
  };

  const fetchActiveTellers = async () => {
    try {
      const res = await axios.get(`${API}/api/teller-management`);
      const active = (res.data || []).filter(t => t.capital && t.capital > 0);
      setActiveTellers(active);
    } catch (err) {
      console.error("❌ Failed to fetch active tellers:", err);
    }
  };

  const fetchActiveSupervisors = async () => {
    try {
      const res = await axios.get(`${API}/api/admin/users`);
      const supervisors = (res.data || []).filter(u => u.role === 'supervisor');
      
      // Get capital data to see which supervisors added capital
      const capitalRes = await axios.get(`${API}/api/teller-management`);
      const capitalData = capitalRes.data || [];
      
      // Map supervisors with their active tellers
      const supervisorsWithActivity = supervisors.map(sup => {
        const assignedTellers = capitalData.filter(t => 
          t.supervisorId === sup._id && t.capital && t.capital > 0
        );
        return {
          ...sup,
          activeTellersCount: assignedTellers.length,
          totalCapitalAssigned: assignedTellers.reduce((sum, t) => sum + (t.capital || 0), 0)
        };
      }).filter(s => s.activeTellersCount > 0);
      
      setActiveSupervisors(supervisorsWithActivity);
    } catch (err) {
      console.error("❌ Failed to fetch active supervisors:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const [usersRes, pendingRes, reportsRes, payrollRes] = await Promise.all([
        axios.get(`${API}/api/admin/users`),
        axios.get(`${API}/api/admin/pending-count`),
        axios.get(`${API}/api/teller-reports`),
        axios.get(`${API}/api/payroll/all`)
      ]);

      const today = new Date().toDateString();
      const todayReports = (reportsRes.data || []).filter(r => 
        new Date(r.createdAt).toDateString() === today
      );

      setStats({
        totalUsers: usersRes.data?.length || 0,
        pendingApprovals: pendingRes.data?.pendingCount || 0,
        todayReports: todayReports.length,
        totalPayroll: (payrollRes.data?.payrolls || [])
          .reduce((sum, p) => sum + (p.totalSalary || 0), 0)
      });
    } catch (err) {
      console.error("❌ Failed to fetch stats:", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchActiveTellers();
    fetchActiveSupervisors();
    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchActiveTellers();
      fetchActiveSupervisors();
      fetchStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const revolving =
    Number(data.startingCapital || 0) +
    Number(data.additional || 0) -
    Number(data.remittance || 0);
  const cashbox =
    Number(data.overallCapital || 0) -
    (Number(data.startingCapital || 0) + Number(data.additional || 0)) +
    Number(data.remittance || 0);

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
          <Activity className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          Admin Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Real-time overview of system activity
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard 
          icon={<Users className="w-6 h-6" />}
          title="Total Users" 
          value={stats.totalUsers}
          subtitle="Registered"
          color="blue"
        />
        <StatCard 
          icon={<AlertCircle className="w-6 h-6" />}
          title="Pending Approvals" 
          value={stats.pendingApprovals}
          subtitle="Waiting approval"
          color="yellow"
        />
        <StatCard 
          icon={<CheckCircle className="w-6 h-6" />}
          title="Today's Reports" 
          value={stats.todayReports}
          subtitle="Submitted today"
          color="green"
        />
        <StatCard 
          icon={<DollarSign className="w-6 h-6" />}
          title="Total Payroll" 
          value={`₱${stats.totalPayroll.toLocaleString()}`}
          subtitle="All employees"
          color="purple"
        />
      </div>

      {/* Capital Overview */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Capital Overview
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <DashboardCard title="💰 Overall Capital" value={data.overallCapital} />
          <DashboardCard title="🏦 Starting Capital" value={data.startingCapital} />
          <DashboardCard title="➕ Additional" value={data.additional} />
          <DashboardCard title="💸 Remittance" value={data.remittance} />
          <DashboardCard title="🔁 Revolving" value={revolving} />
          <DashboardCard title="💼 Cashbox" value={cashbox} />
        </div>
      </div>

      {/* Active Tellers */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5" />
          Active Tellers ({activeTellers.length})
        </h2>
        {activeTellers.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeTellers.map((teller) => (
              <div 
                key={teller._id} 
                className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 border-green-500"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{teller.name}</h3>
                  <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                    Active
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Capital:</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      ₱{(teller.capital || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Supervisor:</span>
                    <span className="font-medium">
                      {teller.supervisorName || 'Not assigned'}
                    </span>
                  </div>
                  {teller.additional > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Additional:</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        +₱{(teller.additional || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 bg-white dark:bg-gray-800 rounded-lg text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No active tellers with capital at the moment</p>
          </div>
        )}
      </div>

      {/* Active Supervisors */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Active Supervisors ({activeSupervisors.length})
        </h2>
        {activeSupervisors.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeSupervisors.map((supervisor) => (
              <div 
                key={supervisor._id} 
                className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 border-blue-500"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{supervisor.name || supervisor.username}</h3>
                  <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                    Active
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Tellers:</span>
                    <span className="font-semibold">{supervisor.activeTellersCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Capital:</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      ₱{(supervisor.totalCapitalAssigned || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 bg-white dark:bg-gray-800 rounded-lg text-center text-gray-500">
            <UserCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No active supervisors with assigned tellers</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardCard({ title, value }) {
  return (
    <div className="p-5 bg-white dark:bg-gray-800 rounded-xl shadow-md">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
        {title}
      </h2>
      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
        ₱{Number(value || 0).toLocaleString()}
      </p>
    </div>
  );
}

function StatCard({ icon, title, value, subtitle, color = "blue" }) {
  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300",
    green: "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300",
    yellow: "bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300",
    purple: "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300",
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</h3>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-500">{subtitle}</p>
    </div>
  );
}
