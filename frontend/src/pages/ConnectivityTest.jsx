import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiConfig';

export default function ConnectivityTest() {
  const [results, setResults] = useState([]);
  const [testing, setTesting] = useState(true);

  useEffect(() => {
    const runTests = async () => {
      const testResults = [];
      const apiUrl = getApiUrl();

      // Test 1: Basic health check
      const healthStart = Date.now();
      try {
        const res = await axios.get(`${apiUrl}/api/health`, { timeout: 3000 });
        const duration = Date.now() - healthStart;
        testResults.push({
          name: 'Health Check',
          status: '✅ PASS',
          duration: `${duration}ms`,
          data: res.data
        });
      } catch (err) {
        const duration = Date.now() - healthStart;
        testResults.push({
          name: 'Health Check',
          status: '❌ FAIL',
          duration: `${duration}ms`,
          error: err.message,
          code: err.code
        });
      }

      // Test 2: Settings endpoint
      const settingsStart = Date.now();
      try {
        const res = await axios.get(`${apiUrl}/api/settings`, { timeout: 10000 });
        const duration = Date.now() - settingsStart;
        testResults.push({
          name: 'Settings Endpoint',
          status: '✅ PASS',
          duration: `${duration}ms`,
          hasData: !!res.data
        });
      } catch (err) {
        const duration = Date.now() - settingsStart;
        testResults.push({
          name: 'Settings Endpoint',
          status: '❌ FAIL',
          duration: `${duration}ms`,
          error: err.message,
          code: err.code,
          statusCode: err.response?.status
        });
      }

      // Test 3: API URL resolution
      testResults.push({
        name: 'API URL Resolution',
        status: '✅ INFO',
        apiUrl: apiUrl,
        hostname: window.location.hostname,
        protocol: window.location.protocol
      });

      // Test 4: Device info
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      testResults.push({
        name: 'Device Detection',
        status: '✅ INFO',
        isMobile: isMobile,
        userAgent: navigator.userAgent.substring(0, 100)
      });

      setResults(testResults);
      setTesting(false);
    };

    runTests();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#1e1e1e', color: '#00ff00', minHeight: '100vh' }}>
      <h1>🔌 Backend Connectivity Test</h1>
      {testing ? (
        <p>Testing...</p>
      ) : (
        <div>
          {results.map((result, i) => (
            <div key={i} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #444', borderRadius: '4px' }}>
              <h3>{result.name}</h3>
              <p><strong>Status:</strong> {result.status}</p>
              {result.duration && <p><strong>Duration:</strong> {result.duration}</p>}
              {result.error && <p><strong>Error:</strong> {result.error}</p>}
              {result.code && <p><strong>Error Code:</strong> {result.code}</p>}
              {result.statusCode && <p><strong>HTTP Status:</strong> {result.statusCode}</p>}
              {result.apiUrl && <p><strong>API URL:</strong> {result.apiUrl}</p>}
              {result.hostname && <p><strong>Hostname:</strong> {result.hostname}</p>}
              {result.isMobile !== undefined && <p><strong>Is Mobile:</strong> {result.isMobile ? 'YES' : 'NO'}</p>}
              {result.userAgent && <p><strong>User Agent:</strong> {result.userAgent}...</p>}
              {result.data && <pre style={{ overflow: 'auto', maxHeight: '200px', backgroundColor: '#111' }}>{JSON.stringify(result.data, null, 2)}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
