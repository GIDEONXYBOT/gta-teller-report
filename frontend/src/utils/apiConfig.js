/**
 * API URL Configuration with Auto-Detect IP
 * 
 * - Uses current browser hostname (auto-detects IP if accessed via IP)
 * - Backend strict port: 5000
 * - Maps production domains to backend endpoints
 * - Handles mobile network requests
 * 
 * IMPORTANT: Always use getApiUrl() function, NOT the API_URL constant
 */

// Get API URL based on current hostname - computes fresh each time
export function getApiUrl() {
  if (typeof window === 'undefined') {
    // Server-side rendering or build time - return placeholder
    return 'http://localhost:5000';
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Check for environment variable FIRST (works with Cloudflare/Vercel env vars)
  // Set VITE_API_URL before building for online deployment
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    console.log('✅ Using env variable API URL:', envUrl);
    return envUrl;
  }
  
  // Map production domains to their respective backends (fallback)
  const domainMap = {
    'rmi.gideonbot.xyz': 'https://rmi-backend-zhdr.onrender.com',
    'www.rmi.gideonbot.xyz': 'https://rmi-backend-zhdr.onrender.com',
  };

  // Check if we have a mapped domain
  if (domainMap[hostname]) {
    console.log('✅ Using mapped domain:', domainMap[hostname]);
    return domainMap[hostname];
  }

  // Check for localhost or 127.0.0.1 (development)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('✅ Using localhost development URL');
    return 'http://localhost:5000';
  }

  // For mobile/network access via IP address, try to connect to port 5000
  console.log('✅ Using IP address with port 5000:', `${protocol}//${hostname}:5000`);
  return `${protocol}//${hostname}:5000`;
}

// Export hostname getter
export const getHost = () => window.location.hostname;

// Socket creation helper using dynamic URL
export function createSocket(io, options = {}) {
  const socketUrl = getApiUrl();
  console.log('🔌 Creating socket with URL:', socketUrl);
  return io(socketUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    ...options
  });
}

// BACKWARD COMPATIBILITY - but use getApiUrl() function instead!
export const API_URL = getApiUrl();
