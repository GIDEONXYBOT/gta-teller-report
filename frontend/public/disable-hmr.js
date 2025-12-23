// Disable HMR WebSocket when accessing from network IP to prevent timeout errors
(function() {
  // Check if we're accessing via network IP instead of localhost
  const isNetworkAccess = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  
  if (isNetworkAccess) {
    // Override WebSocket to prevent HMR connection attempts when accessing from network
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      // Block any WebSocket connections to localhost when we're on network IP
      if (typeof url === 'string' && (
        url.includes('localhost:5173') || 
        url.includes('127.0.0.1:5173') || 
        url.includes('vite-ping') ||
        url.includes('/__vite_ping') ||
        (url.includes(':5173') && !url.includes(window.location.hostname))
      )) {
        console.log('🚫 Blocked Vite HMR WebSocket:', url);
        // Return a mock WebSocket that appears to connect but does nothing
        const mockSocket = {
          close: function() { console.log('🚫 Mock WebSocket close called'); },
          send: function() { console.log('🚫 Mock WebSocket send called'); },
          addEventListener: function(event, handler) { 
            if (event === 'open') {
              // Simulate immediate connection failure to prevent timeouts
              setTimeout(() => {
                if (handler) handler({ type: 'error', target: this });
              }, 1);
            }
          },
          removeEventListener: function() {},
          readyState: 3, // CLOSED
          CONNECTING: 0,
          OPEN: 1,
          CLOSING: 2,
          CLOSED: 3,
          url: url
        };
        return mockSocket;
      }
      
      // Allow socket.io and other non-Vite WebSocket connections
      console.log('✅ Allowing WebSocket connection:', url);
      return new originalWebSocket(url, protocols);
    };
    
    // Copy static properties
    Object.assign(window.WebSocket, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3
    });
    
    console.log('🔒 Enhanced HMR WebSocket blocking active for network access');
  }
})();