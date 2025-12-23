import React, { useState, useEffect } from 'react';

export default function MobileDebugPage() {
  const [debugInfo, setDebugInfo] = useState({});
  const [testResults, setTestResults] = useState({});

  // Get API URL dynamically - directly from window.location
  const MOBILE_API_URL = `http://${window.location.hostname}:5000`;

  useEffect(() => {
    const info = {
      userAgent: navigator.userAgent,
      currentUrl: window.location.href,
      hostname: window.location.hostname,
      origin: window.location.origin,
      apiUrl: `http://${window.location.hostname}:5000`, // Direct computation
      screenSize: `${window.screen.width}x${window.screen.height}`,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      localStorage: {
        hasToken: !!localStorage.getItem('token'),
        hasUser: !!localStorage.getItem('user'),
      }
    };
    setDebugInfo(info);
  }, []);

  const testConnection = async () => {
    const results = {};
    
    try {
      const response = await fetch(`${MOBILE_API_URL}/api/health`);
      const data = await response.json();
      results.health = { success: true, data };
    } catch (error) {
      results.health = { success: false, error: error.message };
    }

    try {
      const response = await fetch(`${MOBILE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: 'test' })
      });
      results.loginEndpoint = { success: true, status: response.status };
    } catch (error) {
      results.loginEndpoint = { success: false, error: error.message };
    }

    setTestResults(results);
  };

  const testLogin = async () => {
    try {
      const response = await fetch(`${MOBILE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: '12345' })
      });
      const data = await response.json();
      
      if (response.ok) {
        setTestResults(prev => ({
          ...prev,
          realLogin: { success: true, user: data.user }
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          realLogin: { success: false, error: data.message }
        }));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        realLogin: { success: false, error: error.message }
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">🔧 Mobile Debug Page</h1>

        {/* Device Info */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-3">📱 Device Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Mobile Device:</strong> {debugInfo.isMobile ? 'Yes' : 'No'}</p>
            <p><strong>Screen Size:</strong> {debugInfo.screenSize}</p>
            <p className="text-red-600"><strong>⚠️ Hostname:</strong> {debugInfo.hostname}</p>
            <p className="text-blue-600"><strong>Origin:</strong> {debugInfo.origin}</p>
            <p><strong>Current URL:</strong> {debugInfo.currentUrl}</p>
            <p className="text-green-600"><strong>API URL:</strong> {debugInfo.apiUrl}</p>
            <p><strong>User Agent:</strong> <span className="break-all">{debugInfo.userAgent}</span></p>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-xs text-yellow-800">
                <strong>⚠️ Important:</strong> If hostname shows "localhost", access this page via your network IP instead: 
                <br/>Try: <strong className="text-blue-600">http://192.168.254.128:5173/mobile-debug</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-lg font-semibold mb-3">🧪 Connection Tests</h2>
          <div className="space-y-2">
            <button 
              onClick={testConnection}
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
            >
              Test Backend Connection
            </button>
            <button 
              onClick={testLogin}
              className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600"
            >
              Test Admin Login (admin/12345)
            </button>
          </div>
        </div>

        {/* Test Results */}
        {Object.keys(testResults).length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="text-lg font-semibold mb-3">📊 Test Results</h2>
            <div className="space-y-4">
              {testResults.health && (
                <div className={`p-3 rounded ${testResults.health.success ? 'bg-green-100' : 'bg-red-100'}`}>
                  <strong>Health Check:</strong> {testResults.health.success ? '✅ Success' : '❌ Failed'}
                  <pre className="text-xs mt-1">{JSON.stringify(testResults.health, null, 2)}</pre>
                </div>
              )}
              
              {testResults.loginEndpoint && (
                <div className={`p-3 rounded ${testResults.loginEndpoint.success ? 'bg-green-100' : 'bg-red-100'}`}>
                  <strong>Login Endpoint:</strong> {testResults.loginEndpoint.success ? '✅ Reachable' : '❌ Failed'}
                  <pre className="text-xs mt-1">{JSON.stringify(testResults.loginEndpoint, null, 2)}</pre>
                </div>
              )}

              {testResults.realLogin && (
                <div className={`p-3 rounded ${testResults.realLogin.success ? 'bg-green-100' : 'bg-red-100'}`}>
                  <strong>Real Login Test:</strong> {testResults.realLogin.success ? '✅ Success' : '❌ Failed'}
                  <pre className="text-xs mt-1">{JSON.stringify(testResults.realLogin, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-3">💡 Instructions</h2>
          <div className="text-sm space-y-2">
            <p>1. Run connection tests to verify backend accessibility</p>
            <p>2. If tests pass, try login with credentials:</p>
            <p className="ml-4"><strong>Username:</strong> admin</p>
            <p className="ml-4"><strong>Password:</strong> 12345</p>
            <p>3. Check browser console for detailed logs</p>
            <p>4. If still failing, check WiFi connection and try different browser</p>
          </div>
        </div>
      </div>
    </div>
  );
}