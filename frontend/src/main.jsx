import React, { useContext } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { PageWrapper } from './components/PageWrapper.jsx';
import UpdateStatus from './components/UpdateStatus.jsx';
import "./index.css";
import axios from "axios";

// Detect if running on mobile device
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

// Import getApiUrl for health checks
import { getApiUrl } from './utils/apiConfig.js';

// Pre-flight health check to warm up backend on cold starts
const preFlightHealthCheck = async () => {
  try {
    const apiUrl = getApiUrl();
    console.log(`🔍 Pre-flight health check to ${apiUrl}/api/health`);
    const response = await axios.get(`${apiUrl}/api/health`, {
      timeout: 15000 // 15s timeout for initial check
    });
    console.log('✅ Backend is healthy, proceeding with app load');
    return true;
  } catch (error) {
    console.warn('⚠️ Pre-flight health check failed, but app will retry on demand:', error.message);
    // Don't block app load, let the retry logic handle it
    return false;
  }
};

// Run health check on app start
preFlightHealthCheck();

// Set axios default timeout - longer for mobile devices to account for slower connections
const timeoutMs = isMobileDevice() ? 60000 : 30000; // 60s for mobile, 30s for desktop
axios.defaults.timeout = timeoutMs;
console.log(`⏱️ Axios timeout set to ${timeoutMs}ms (Mobile: ${isMobileDevice()})`);

// Add retry logic for failed requests (especially important for mobile/slow connections)
const axiosRetry = async (config, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.request(config);
      return response;
    } catch (error) {
      // Don't retry on 4xx errors (auth, validation, etc)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        throw error;
      }
      
      // Retry on 5xx errors or network errors
      if (i < retries - 1) {
        const backoffDelay = delay * Math.pow(2, i); // Exponential backoff
        console.warn(`⚠️ Request failed, retrying in ${backoffDelay}ms (attempt ${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      } else {
        throw error;
      }
    }
  }
};

// Override axios request to add retry logic for mobile
const originalRequest = axios.request;
axios.request = function(config) {
  // Add retry logic for GET requests (safe to retry)
  if (config.method === 'GET' || config.method === 'get') {
    return axiosRetry(config, isMobileDevice() ? 4 : 2, isMobileDevice() ? 1500 : 1000);
  }
  return originalRequest.call(this, config);
};

// Add axios interceptor to include Authorization header
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Ensure timeout is set on each request
    config.timeout = timeoutMs;
    console.log(`📤 ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add axios response interceptor for better mobile error handling
axios.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    // Log network errors for debugging
    const errorMsg = error.message || 'Unknown error';
    const url = error.config?.url || 'unknown';
    
    if (error.code === 'ECONNABORTED') {
      console.error(`⏱️ Timeout on ${error.config?.method?.toUpperCase()} ${url}`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error(`🔌 Connection refused on ${error.config?.method?.toUpperCase()} ${url}`);
    } else if (error.response) {
      console.error(`❌ ${error.response.status} on ${error.config?.method?.toUpperCase()} ${url}: ${error.response.statusText}`);
    } else {
      console.error(`🌐 Network error on ${error.config?.method?.toUpperCase()} ${url}: ${errorMsg}`);
    }
    return Promise.reject(error);
  }
);

// Context
import { SettingsProvider, SettingsContext } from "./context/SettingsContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { ChickenFightProvider } from "./context/ChickenFightContext.jsx";

// Layout
import SidebarLayout from "./components/SidebarLayout.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Auth Pages
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import MobileDebugPage from "./pages/MobileDebugPage.jsx";
import ConnectivityTest from "./pages/ConnectivityTest.jsx";

// Shared Pages
import Dashboard from "./pages/Dashboard.jsx";
import TellerReports from "./pages/TellerReports.jsx";
import TellerReportsViewer from "./pages/TellerReportsViewer.jsx";
import TellerReportsHistory from "./pages/TellerReportsHistory.jsx";
import TellerOfMonth from "./pages/TellerOfMonth.jsx";
import Payroll from "./pages/Payroll.jsx";
import SupervisorReports from "./pages/SupervisorReports.jsx";
import TellerManagement from "./pages/TellerManagement.jsx";

// Admin Pages
import AdminSalaryOver from "./pages/AdminSalaryOver.jsx";
import AdminReport from "./pages/AdminReport.jsx";
import AdminAssistantAdmin from "./pages/AdminAssistantAdmin.jsx";
import AdminCashflow from "./pages/AdminCashFlow.jsx";
import AdminUserApproval from "./pages/AdminUserApproval.jsx";
import AdminTellerOverview from "./pages/AdminTellerOverview.jsx";
import AdminHistory from "./pages/AdminHistory.jsx";
import AdminSettings from "./pages/AdminSettings.jsx";
import AdminEmployees from "./pages/AdminEmployees.jsx";
import PayrollManagement from "./pages/PayrollManagement.jsx";
import PayrollBaseSalaryFixer from "./components/PayrollBaseSalaryFixer.jsx";
import WithdrawalApprovals from "./pages/WithdrawalApprovals.jsx";
import AdminMapEditor from "./pages/AdminMapEditor.jsx";
import AdminFinancialSummary from "./pages/AdminFinancialSummary.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import TellerBettingData from "./pages/TellerBettingData.jsx";
import ManageBettingData from "./pages/ManageBettingData.jsx";
import BettingAnalytics from "./pages/BettingAnalytics.jsx";
import AdvancedTellerAssignment from "./pages/AdvancedTellerAssignment.jsx";
import NotificationCenter from "./pages/NotificationCenter.jsx";
import BettingEventReport from "./pages/BettingEventReport.jsx";
import KeyPerformanceIndicator from "./pages/KeyPerformanceIndicator.jsx";
import TellerMappings from "./pages/TellerMappings.jsx";
import UploadPage from "./pages/UploadPage.jsx";
import FeedPage from "./pages/FeedPage.jsx";
import UsersList from "./pages/UsersList.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import MyProfile from "./pages/MyProfile.jsx";
import PublicLeaderboard from "./pages/PublicLeaderboard.jsx";
import TellerSalaryCalculation from "./pages/TellerSalaryCalculation.jsx";

// Supervisor Pages
import SupervisorHistory from "./pages/SupervisorHistory.jsx";
import SupervisorStaffPerformance from "./pages/SupervisorStaffPerformance.jsx";
import MyShift from "./pages/MyShift.jsx";

// ✅ Added for real-time schedule rotation
import ScheduleRotation from "./pages/ScheduleRotation.jsx";
import AttendanceScheduler from "./pages/AttendanceScheduler.jsx";

// 🐔 Chicken Fight Pages
import ChickenFight from "./pages/ChickenFight.jsx";
import ChickenFightEntries from "./pages/ChickenFightEntries.jsx";
import ChickenFightResults from "./pages/ChickenFightResults.jsx";
import LiveCockFightCamera from "./pages/LiveCockFightCamera.jsx";
import BettingCaptureScreen from "./pages/BettingCaptureScreen.jsx";
import CameraStreamBroadcaster from "./pages/CameraStreamBroadcaster.jsx";
import LiveChickenFightDashboard from "./components/LiveChickenFightDashboard.jsx";

// Declarator Pages
import DeclaratorDashboard from "./pages/DeclaratorDashboardFixed.jsx";
import TellerDeployments from "./pages/TellerDeployments.jsx";
import SuperAdminSidebarControl from './pages/SuperAdminSidebarControl.jsx';
import SuperAdminMenuConfig from './pages/SuperAdminMenuConfig.jsx';
// MapEditor import removed (using unified AdminMapEditor for map editing)
// import MapEditor from './pages/MapEditor.jsx';

// Fallback Page
const NotFound = () => (
  <div className="p-8 text-center text-gray-500">404 — Page Not Found</div>
);

/** 🔒 Role-based Protected Route Component */
function ProtectedRoute({ role, allowedRoles, children }) {
  const { user } = useContext(SettingsContext);
  const location = useLocation();
  const token = localStorage.getItem("token");

  if (!token) return <Navigate to="/login" replace />;

  // Determine allowed roles for this route
  const roles = Array.isArray(allowedRoles) && allowedRoles.length > 0 ? allowedRoles : (role ? [role] : []);

  // If user role not in allowed list, handle hybrid supervisor_teller
  const urole = user?.role;
  const isSuperAdminUsername = (user?.username === 'admin');
  // Accept any username containing 'alfonso' (case-insensitive) — e.g., Alfonso, Alfonso00
  const isAlfonsoUsername = (user?.username || '').toLowerCase().includes('alfonso');
  const isSuperAdminRole = (urole === 'super_admin');
  const ok = (
    roles.includes(urole) ||
    (urole === "supervisor_teller" && (roles.includes("teller") || roles.includes("supervisor"))) ||
    ((isSuperAdminUsername || isSuperAdminRole) && roles.includes('super_admin')) ||
    ((isSuperAdminUsername || isSuperAdminRole) && roles.includes('admin'))
  );

  // Allow the user 'alfonso' to access schedule-related pages regardless of role
  if (!ok && isAlfonsoUsername) {
    if (location.pathname.includes('suggested-schedule') || location.pathname.includes('attendance-scheduler')) {
      return children;
    }
  }

  if (!ok) return <Navigate to={`/${urole || ""}/dashboard`} replace />;

  return children;
}

/** Small auth-only wrapper component */
function AuthOnly({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <ToastProvider>
          <ChickenFightProvider>
            <HashRouter>
              <PageWrapper>
                <UpdateStatus />
                <Routes>
            {/* Redirect root to login */}
            <Route path="/" element={<Navigate to="/login" />} />

            {/* Auth Pages */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/mobile-debug" element={<MobileDebugPage />} />
            <Route path="/connectivity-test" element={<ConnectivityTest />} />
            {/* Public Leaderboard - accessible without authentication */}
            <Route path="/leaderboard" element={<PublicLeaderboard />} />
            {/* Small auth wrapper — only requires a token (component defined below) */}

            {/* Universal upload page — open to any logged-in user */}
            <Route path="/upload" element={
              <AuthOnly>
                <SidebarLayout>
                  <UploadPage />
                </SidebarLayout>
              </AuthOnly>
            } />
            {/* Users directory */}
            <Route path="/users" element={
              <AuthOnly>
                <SidebarLayout>
                  <UsersList />
                </SidebarLayout>
              </AuthOnly>
            } />

            <Route path="/users/:id" element={
              <AuthOnly>
                <SidebarLayout>
                  <UserProfile />
                </SidebarLayout>
              </AuthOnly>
            } />
            {/* My Profile — current user profile management */}
            <Route path="/profile" element={
              <AuthOnly>
                <SidebarLayout>
                  <MyProfile />
                </SidebarLayout>
              </AuthOnly>
            } />
            {/* Public feed — any logged-in user can view */}
            <Route path="/feed" element={
              <AuthOnly>
                <SidebarLayout>
                  <FeedPage />
                </SidebarLayout>
              </AuthOnly>
            } />
            <Route
              path="/forgot-password"
              element={
                <div className="text-center p-8 text-gray-700">
                  Forgot Password Page (Coming Soon)
                </div>
              }
            />

            {/* ================= ADMIN ================= */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <SidebarLayout role="admin">
                    <Routes>
                      <Route index element={<Navigate to="dashboard" />} />
                      <Route path="dashboard" element={<Dashboard overrideRole="admin" />} />
                      <Route path="supervisor-report" element={<SupervisorReports userRole="admin" />} />
                      <Route path="teller-reports" element={<TellerReports userRole="admin" />} />
                      <Route path="teller-reports/viewer" element={<TellerReportsViewer userRole="admin" />} />
                      <Route path="teller-management" element={<TellerManagement userRole="admin" />} />
                      <Route path="teller-salary-calculation" element={<TellerSalaryCalculation />} />
                      <Route path="teller-overview" element={<AdminTellerOverview />} />
                      <Route path="report" element={<AdminReport />} />
                      <Route path="cashflow" element={<AdminCashflow />} />
                      <Route path="financial-summary" element={<AdminFinancialSummary />} />
                      <Route path="leaderboard" element={<LeaderboardPage />} />
                      <Route path="user-approval" element={<AdminUserApproval />} />
                      <Route path="salary" element={<Payroll />} />
                      {/* Unified: /admin/payroll shows management UI (alias for payroll-management) */}
                      <Route path="payroll" element={<PayrollManagement />} />
                      <Route path="payroll-management" element={<PayrollManagement />} />
                      <Route path="payroll-fixer" element={<PayrollBaseSalaryFixer />} />
                      <Route path="withdrawals" element={<WithdrawalApprovals />} />
                      <Route path="assistant" element={<AdminAssistantAdmin />} />
                      <Route path="deployments" element={<DeclaratorDashboard />} />
                      <Route path="employees" element={<AdminEmployees />} />
                      <Route path="history" element={<AdminHistory />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="teller-month" element={<TellerOfMonth userRole="admin" />} />
                      
                      {/* ✅ Added: Suggested Schedule (real-time) */}
                      <Route path="suggested-schedule" element={<ScheduleRotation />} />
                      
                      {/* 🤖 Added: AI Attendance-Based Scheduler */}
                      <Route path="attendance-scheduler" element={<AttendanceScheduler />} />
                      
                      {/* 🔐 Super Admin Only: Menu Permissions Manager */}
                      <Route path="menu-config" element={<SuperAdminMenuConfig />} />
                      {/* Super Admin Sidebar Control accessible under admin for primary admin account */}
                      <Route path="manage-sidebars" element={<SuperAdminSidebarControl />} />
                      <Route path="live-map" element={<AdminMapEditor />} />
                      <Route path="map-editor" element={<AdminMapEditor />} />
                      <Route path="teller-betting" element={<TellerBettingData />} />
                      <Route path="manage-betting" element={<ManageBettingData />} />
                      <Route path="betting-analytics" element={<BettingAnalytics />} />
                      <Route path="teller-assignment" element={<AdvancedTellerAssignment />} />
                      <Route path="notifications" element={<NotificationCenter />} />
                      <Route path="key-performance-indicator" element={<KeyPerformanceIndicator />} />
                      {/* Provide alias so admin URL works as well */}
                      <Route path="betting-event-report" element={<BettingEventReport />} />
                      
                      {/* 🐔 Chicken Fight */}
                      <Route path="chicken-fight" element={<ChickenFight />} />
                      <Route path="chicken-fight-entries" element={<ChickenFightEntries />} />
                      <Route path="chicken-fight-results" element={<ChickenFightResults />} />
                      <Route path="live-cockfight-camera" element={<LiveCockFightCamera />} />
                      <Route path="betting-capture-screen" element={<BettingCaptureScreen />} />
                      <Route path="stream-broadcaster" element={<CameraStreamBroadcaster />} />
                      
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />

            {/* ================= SUPERVISOR ================= */}
            <Route
              path="/supervisor/*"
              element={
                <ProtectedRoute allowedRoles={["supervisor", "supervisor_teller"]}>
                  <SidebarLayout role="supervisor">
                    <Routes>
                      <Route index element={<Navigate to="dashboard" />} />
                      <Route path="dashboard" element={<Dashboard overrideRole="supervisor" />} />
                      <Route path="supervisor-report" element={<SupervisorReports userRole="supervisor" />} />
                      <Route path="teller-reports" element={<TellerReports userRole="supervisor" />} />
                      <Route path="teller-reports/viewer" element={<TellerReportsViewer userRole="supervisor" />} />
                      <Route path="teller-management" element={<TellerManagement userRole="supervisor" />} />
                      <Route path="teller-salary-calculation" element={<TellerSalaryCalculation />} />
                      <Route path="staff-performance" element={<SupervisorStaffPerformance />} />
                      <Route path="payroll" element={<Payroll />} />
                      <Route path="my-shift" element={<MyShift />} />
                      <Route path="teller-month" element={<TellerOfMonth userRole="supervisor" />} />
                      <Route path="history" element={<SupervisorHistory />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="deployments" element={<DeclaratorDashboard viewOnly={true} />} />
                      
                      {/* ✅ Added: Suggested Schedule (real-time) */}
                      <Route path="suggested-schedule" element={<ScheduleRotation />} />
                      
                      {/* 🤖 Added: AI Attendance-Based Scheduler */}
                      <Route path="attendance-scheduler" element={<AttendanceScheduler />} />
                      <Route path="live-map" element={<AdminMapEditor />} />
                      <Route path="map-editor" element={<AdminMapEditor />} />
                      <Route path="key-performance-indicator" element={<KeyPerformanceIndicator />} />
                      
                      {/* 🎯 Betting Event Report */}
                      <Route path="betting-event-report" element={<BettingEventReport />} />
                      
                      {/* 🐔 Chicken Fight */}
                      <Route path="chicken-fight" element={<ChickenFight />} />
                      <Route path="chicken-fight-entries" element={<ChickenFightEntries />} />
                      <Route path="chicken-fight-results" element={<ChickenFightResults />} />
                      <Route path="live-cockfight-camera" element={<LiveCockFightCamera />} />
                      <Route path="betting-capture-screen" element={<BettingCaptureScreen />} />
                      <Route path="stream-broadcaster" element={<CameraStreamBroadcaster />} />
                      
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />

            {/* ================= TELLER ================= */}
            <Route
              path="/teller/*"
              element={
                <ProtectedRoute allowedRoles={["teller", "supervisor_teller"]}>
                  <SidebarLayout role="teller">
                    <Routes>
                      <Route index element={<Navigate to="dashboard" />} />
                      <Route path="dashboard" element={<Dashboard overrideRole="teller" />} />
                      <Route path="teller-reports" element={<TellerReports userRole="teller" />} />
                      <Route path="teller-reports/viewer" element={<TellerReportsViewer userRole="teller" />} />
                      <Route path="reports-history" element={<TellerReportsHistory />} />
                      <Route path="payroll" element={<Payroll />} />
                      <Route path="teller-month" element={<TellerOfMonth userRole="teller" />} />
                      <Route path="history" element={<TellerReportsHistory />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="deployments" element={<TellerDeployments />} />
                      <Route path="live-map" element={<AdminMapEditor />} />
                      <Route path="betting-event-report" element={<BettingEventReport />} />
                      <Route path="betting-capture-screen" element={<BettingCaptureScreen />} />
                      <Route path="stream-broadcaster" element={<CameraStreamBroadcaster />} />
                      
                      {/* ✅ Added: Suggested Schedule (real-time) */}
                      <Route path="suggested-schedule" element={<ScheduleRotation />} />
                      
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />

            {/* ================= DECLARATOR ================= */}
            <Route
              path="/declarator/*"
              element={
                <ProtectedRoute role="declarator">
                  <SidebarLayout role="declarator">
                    <Routes>
                      <Route index element={<Navigate to="deployments" />} />
                      <Route path="dashboard" element={<Navigate to="deployments" />} />
                      <Route path="upload" element={<UploadPage />} />
                      <Route path="feed" element={<FeedPage />} />
                      <Route path="users" element={<UsersList />} />
                      <Route path="deployments" element={<DeclaratorDashboard />} />
                      <Route path="suggested-schedule" element={<ScheduleRotation />} />
                      <Route path="payroll" element={<Payroll />} />
                      <Route path="live-map" element={<AdminMapEditor />} />
                      <Route path="map-editor" element={<AdminMapEditor />} />
                      <Route path="chicken-fight" element={<ChickenFight />} />
                      <Route path="chicken-fight-entries" element={<ChickenFightEntries />} />
                      <Route path="chicken-fight-results" element={<ChickenFightResults />} />
                      <Route path="live-cockfight-camera" element={<LiveCockFightCamera />} />
                      <Route path="betting-capture-screen" element={<BettingCaptureScreen />} />
                      <Route path="stream-broadcaster" element={<CameraStreamBroadcaster />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />

            {/* ================= SUPER ADMIN ================= */}
            <Route
              path="/super_admin/*"
              element={
                <ProtectedRoute role="super_admin">
                  <SidebarLayout role="super_admin">
                    <Routes>
                      <Route index element={<Navigate to="dashboard" />} />
                      <Route path="dashboard" element={<Dashboard overrideRole="super_admin" />} />
                      <Route path="supervisor-report" element={<SupervisorReports userRole="super_admin" />} />
                      <Route path="teller-reports" element={<TellerReports userRole="super_admin" />} />
                      <Route path="teller-reports/viewer" element={<TellerReportsViewer userRole="super_admin" />} />
                      <Route path="teller-management" element={<TellerManagement userRole="super_admin" />} />
                      <Route path="teller-salary-calculation" element={<TellerSalaryCalculation />} />
                      <Route path="teller-overview" element={<AdminTellerOverview />} />
                      <Route path="report" element={<AdminReport />} />
                      <Route path="cashflow" element={<AdminCashflow />} />
                      <Route path="financial-summary" element={<AdminFinancialSummary />} />
                      <Route path="leaderboard" element={<LeaderboardPage />} />
                      <Route path="user-approval" element={<AdminUserApproval />} />
                      <Route path="salary" element={<Payroll />} />
                      {/* Unified: /admin/payroll shows management UI (alias for payroll-management) */}
                      <Route path="payroll" element={<PayrollManagement />} />
                      <Route path="payroll-management" element={<PayrollManagement />} />
                      <Route path="payroll-fixer" element={<PayrollBaseSalaryFixer />} />
                      <Route path="withdrawals" element={<WithdrawalApprovals />} />
                      <Route path="assistant" element={<AdminAssistantAdmin />} />
                      <Route path="deployments" element={<DeclaratorDashboard />} />
                      <Route path="history" element={<AdminHistory />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="teller-month" element={<TellerOfMonth userRole="super_admin" />} />
                      
                      {/* ✅ Added: Suggested Schedule (real-time) */}
                      <Route path="suggested-schedule" element={<ScheduleRotation />} />
                      
                      {/* 🤖 Added: AI Attendance-Based Scheduler */}
                      <Route path="attendance-scheduler" element={<AttendanceScheduler />} />
                      <Route path="live-map" element={<AdminMapEditor />} />
                      <Route path="map-editor" element={<AdminMapEditor />} />
                      <Route path="teller-betting" element={<TellerBettingData />} />
                      <Route path="manage-betting" element={<ManageBettingData />} />
                      <Route path="betting-analytics" element={<BettingAnalytics />} />
                      <Route path="teller-assignment" element={<AdvancedTellerAssignment />} />
                      <Route path="notifications" element={<NotificationCenter />} />
                      
                      {/* 🎯 Betting Event Report */}
                      <Route path="betting-event-report" element={<BettingEventReport />} />
                      
                      {/* 🐔 Chicken Fight */}
                      <Route path="chicken-fight" element={<ChickenFight />} />
                      <Route path="chicken-fight-entries" element={<ChickenFightEntries />} />
                      <Route path="chicken-fight-results" element={<ChickenFightResults />} />
                      <Route path="live-chicken-fight-dashboard" element={<LiveChickenFightDashboard />} />
                      <Route path="live-cockfight-camera" element={<LiveCockFightCamera />} />
                      <Route path="betting-capture-screen" element={<BettingCaptureScreen />} />
                      <Route path="stream-broadcaster" element={<CameraStreamBroadcaster />} />
                      
                      <Route path="key-performance-indicator" element={<KeyPerformanceIndicator />} />
                      <Route path="teller-mappings" element={<TellerMappings />} />
                      
                      {/* New route for SuperAdminSidebarControl (relative path) */}
                      <Route path="manage-sidebars" element={<SuperAdminSidebarControl />} />
                      <Route path="menu-config" element={<SuperAdminMenuConfig />} />
                      
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />

            {/* Default Redirects */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" />} />
            <Route path="/supervisor" element={<Navigate to="/supervisor/dashboard" />} />
            <Route path="/teller" element={<Navigate to="/teller/dashboard" />} />
            <Route path="/declarator" element={<Navigate to="/declarator/deployments" />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
                </Routes>
              </PageWrapper>
            </HashRouter>
          </ChickenFightProvider>
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
