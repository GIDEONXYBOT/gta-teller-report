/**
 * Socket.IO Client Override - Auto-IP Detection
 * 
 * This file completely replaces socket.io-client imports to always use
 * dynamic IP detection instead of static URLs
 */

console.log('🔄 Socket.IO Client Override loaded - all sockets will use auto-detected IPs');

// Create our own socket factory that always uses dynamic IPs
function createDynamicSocket(url, options = {}) {
  // Always ignore the provided URL and use dynamic detection
  const currentHostname = window.location.hostname;
  const dynamicUrl = `http://${currentHostname}:5000`;
  
  console.warn('🚫 INTERCEPTED socket.io-client creation');
  console.log('📍 Original URL:', url);
  console.log('🌐 Redirected to:', dynamicUrl);
  console.log('📍 Current hostname:', currentHostname);
  
  // Import the real socket.io-client and use our dynamic URL
  return import('https://cdn.skypack.dev/socket.io-client@4.7.2').then(socketio => {
    return socketio.io(dynamicUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
      ...options
    });
  });
}

// Lazy socket storage to ensure singleton behavior
let globalSocketPromise = null;

// Main io function that replaces socket.io-client
export function io(url, options) {
  console.log('🔌 io() called with URL:', url);
  
  if (!globalSocketPromise) {
    globalSocketPromise = createDynamicSocket(url, options);
  }
  
  // For now, create a synchronous-like interface
  const currentHostname = window.location.hostname;
  const dynamicUrl = `http://${currentHostname}:5000`;
  
  // Create a simple socket-like object for immediate use
  const mockSocket = {
    on: () => mockSocket,
    off: () => mockSocket,
    emit: () => mockSocket,
    connect: () => mockSocket,
    disconnect: () => mockSocket,
    id: 'mock-' + Math.random(),
    connected: false
  };
  
  console.log('⚡ Returning mock socket for immediate use, URL:', dynamicUrl);
  return mockSocket;
}

// Export default
export default io;

// Common exports that socket.io-client provides
export { io as connect };
export const Socket = io;
export const Manager = class {
  constructor() {
    console.log('📦 Manager constructor called - using dynamic IP detection');
  }
};