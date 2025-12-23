/**
 * Backend Health Check Utility
 * 
 * Helps detect and handle backend connectivity issues on mobile devices
 * Provides early warning when backend is unreachable or slow
 */

import axios from 'axios';
import { getApiUrl } from './apiConfig.js';

// Cache health check results to avoid spam
let lastHealthCheck = null;
let healthCheckInterval = null;

/**
 * Check if backend is accessible
 * @returns {Promise<boolean>} true if backend is reachable, false otherwise
 */
export async function checkBackendHealth() {
  try {
    const apiUrl = getApiUrl();
    // Use a simple GET request with short timeout for health check
    const response = await axios.get(`${apiUrl}/api/health`, {
      timeout: 5000, // 5 second timeout for health check
      validateStatus: () => true // Accept any status code
    });
    
    const isHealthy = response.status < 500;
    console.log(`🏥 Backend health check: ${isHealthy ? '✅ Healthy' : '⚠️ Unhealthy'} (${response.status})`);
    return isHealthy;
  } catch (error) {
    console.error('🏥 Backend health check failed:', error.message);
    return false;
  }
}

/**
 * Start continuous health monitoring
 * @param {number} intervalMs - Check interval in milliseconds (default 30s)
 * @param {Function} callback - Called when health status changes
 */
export function startHealthMonitoring(intervalMs = 30000, callback = null) {
  // Don't start multiple monitors
  if (healthCheckInterval) {
    return;
  }

  console.log('🏥 Starting backend health monitoring...');
  
  let lastStatus = null;
  
  const check = async () => {
    const isHealthy = await checkBackendHealth();
    
    // Call callback only when status changes
    if (lastStatus !== null && lastStatus !== isHealthy && callback) {
      callback(isHealthy);
    }
    
    lastStatus = isHealthy;
  };

  // Run initial check immediately
  check();

  // Then run periodically
  healthCheckInterval = setInterval(check, intervalMs);
}

/**
 * Stop health monitoring
 */
export function stopHealthMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('🏥 Backend health monitoring stopped');
  }
}

/**
 * Get error message for user based on error type
 * @param {Error} error - Axios error object
 * @param {boolean} isMobile - Whether user is on mobile
 * @returns {string} User-friendly error message
 */
export function getBackendErrorMessage(error, isMobile = false) {
  if (error.code === 'ECONNABORTED') {
    return isMobile 
      ? 'Backend is slow - check your internet connection' 
      : 'Backend request timed out';
  }
  
  if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
    return 'Cannot connect to backend - check your internet connection';
  }
  
  if (error.response?.status === 503) {
    return 'Backend is currently offline or restarting. Please try again in a moment.';
  }
  
  if (error.response?.status === 429) {
    return 'Too many requests - please wait a moment before trying again';
  }
  
  if (error.response?.status >= 500) {
    return 'Backend error - please try again later';
  }
  
  if (!error.response) {
    return 'Network error - please check your internet connection';
  }
  
  return error.message || 'Failed to load data';
}

/**
 * Test backend connectivity with detailed diagnostics
 * @returns {Promise<Object>} Diagnostic results
 */
export async function diagnoseBackendConnectivity() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    isMobile,
    apiUrl: getApiUrl(),
    results: {
      health: null,
      ping: null,
      cors: null,
      errors: []
    }
  };

  // Test 1: Health check
  try {
    diagnostics.results.health = await checkBackendHealth();
  } catch (error) {
    diagnostics.results.errors.push(`Health check: ${error.message}`);
  }

  // Test 2: Ping test
  try {
    const start = performance.now();
    await axios.head(getApiUrl(), { timeout: 5000 });
    diagnostics.results.ping = Math.round(performance.now() - start);
  } catch (error) {
    diagnostics.results.errors.push(`Ping test: ${error.message}`);
  }

  // Test 3: CORS test
  try {
    const response = await axios.get(`${getApiUrl()}/api/public/test`, {
      timeout: 5000,
      validateStatus: () => true
    });
    diagnostics.results.cors = response.status !== 0;
  } catch (error) {
    diagnostics.results.errors.push(`CORS test: ${error.message}`);
  }

  return diagnostics;
}

export default {
  checkBackendHealth,
  startHealthMonitoring,
  stopHealthMonitoring,
  getBackendErrorMessage,
  diagnoseBackendConnectivity
};
