// Socket.IO handlers for Leaderboard real-time updates
export function initLeaderboardSocket(io) {
  io.on('connection', (socket) => {
    console.log('📊 Leaderboard user connected:', socket.id);

    // Join leaderboard room
    socket.join('leaderboard');

    // Handle leaderboard subscription
    socket.on('subscribe-leaderboard', () => {
      socket.join('leaderboard-updates');
      console.log(`📌 ${socket.id} subscribed to leaderboard updates`);
    });

    // Handle betting updates subscription
    socket.on('subscribe-betting', () => {
      socket.join('betting-updates');
      console.log(`🎯 ${socket.id} subscribed to betting updates`);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Leaderboard user disconnected:', socket.id);
    });
  });
}

// Function to emit leaderboard updates to all connected clients
export function emitLeaderboardUpdate(io, data) {
  io.to('leaderboard-updates').emit('leaderboard-update', {
    ...data,
    timestamp: new Date().toISOString()
  });
  console.log('📊 Emitted leaderboard update to subscribers');
}

// Function to emit betting updates to all connected clients
export function emitBettingUpdate(io, data) {
  io.to('betting-updates').emit('betting-update', {
    ...data,
    timestamp: new Date().toISOString()
  });
  console.log('🎯 Emitted betting update to subscribers');
}