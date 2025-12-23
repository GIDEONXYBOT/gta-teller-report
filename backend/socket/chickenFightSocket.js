// Socket.IO handlers for Chicken Fight real-time updates
export function initChickenFightSocket(io) {
  const chickenFightNamespace = io.of('/chicken-fight');

  chickenFightNamespace.on('connection', (socket) => {
    console.log('🐔 Chicken Fight user connected:', socket.id);

    // Join room for today's fights
    socket.on('joinTodaysFights', (data) => {
      const { gameDate = new Date().toISOString().split('T')[0] } = data || {};
      socket.join(`fights-${gameDate}`);
      console.log(`📌 ${socket.id} joined room: fights-${gameDate}`);
    });

    // Emit when fights are updated
    socket.on('fightsUpdated', (data) => {
      const { gameDate, fights, fightNumber } = data;
      if (!gameDate) return;

      chickenFightNamespace.to(`fights-${gameDate}`).emit('fightsUpdated', {
        fights,
        fightNumber,
        updatedAt: new Date().toISOString()
      });
      console.log(`🔄 Fights updated for ${gameDate}`);
    });

    // Emit when results are recorded
    socket.on('resultsRecorded', (data) => {
      const { gameDate, fight } = data;
      if (!gameDate || !fight) return;

      chickenFightNamespace.to(`fights-${gameDate}`).emit('resultsRecorded', {
        fight,
        updatedAt: new Date().toISOString()
      });
      console.log(`🏆 Results recorded for fight ${fight.fightNumber} on ${gameDate}`);
    });

    // Emit when entries are updated
    socket.on('entriesUpdated', (data) => {
      const { gameDate, entries } = data;
      if (!gameDate) return;

      chickenFightNamespace.to(`entries-${gameDate}`).emit('entriesUpdated', {
        entries,
        updatedAt: new Date().toISOString()
      });
      console.log(`✏️ Entries updated for ${gameDate}`);
    });

    // Emit when registrations are updated
    socket.on('registrationsUpdated', (data) => {
      const { gameDate, registrations } = data;
      if (!gameDate) return;

      chickenFightNamespace.to(`registrations-${gameDate}`).emit('registrationsUpdated', {
        registrations,
        updatedAt: new Date().toISOString()
      });
      console.log(`📝 Registrations updated for ${gameDate}`);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Chicken Fight user disconnected:', socket.id);
    });
  });
}

// Function to emit chicken fight updates to all connected clients
export function emitChickenFightUpdate(io, data) {
  // Emit to main namespace (not chicken-fight namespace) to match frontend usage
  io.emit('chickenFightUpdated', data);
  console.log('📡 Chicken fight live update emitted to all connected clients');
}
