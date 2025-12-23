// scheduler/chickenFightUpdate.js - Periodic chicken fight data fetching and real-time updates
import { emitChickenFightUpdate } from '../socket/chickenFightSocket.js';
import ChickenFightGame from '../models/ChickenFightGame.js';
import ChickenFightBet from '../models/ChickenFightBet.js';
import ChickenFightEntry from '../models/ChickenFightEntry.js';
import { fetchChickenFightBettingData } from '../routes/externalBetting.js';

let updateInterval = null;
let isRunning = false;

export function initChickenFightUpdateScheduler(io) {
  if (isRunning) {
    console.log('🐔 Chicken fight update scheduler already running');
    return;
  }

  isRunning = true;
  console.log('🐔 Starting chicken fight update scheduler...');

  // Function to fetch and emit chicken fight updates
  const fetchAndEmitUpdates = async () => {
    try {
      console.log('🔄 Fetching chicken fight data for live updates...');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch fights for today directly from database
      console.log('📥 Fetching fights data from database...');
      const game = await ChickenFightGame.findOne({ gameDate: today });
      const fightsData = {
        fights: game?.fights || [],
        fightNumber: game?.fightNumber || 0
      };

      // Fetch bets for today directly from database (more inclusive date range)
      console.log('📥 Fetching bets data from database...');
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const bets = await ChickenFightBet.find({
        gameDate: { $gte: startOfDay, $lte: endOfDay }
      }).sort({ createdAt: -1 });

      console.log(`📊 Found ${bets.length} bets for today`);
      if (bets.length > 0) {
        const totalAmount = bets.reduce((sum, bet) => sum + (parseFloat(bet.amount) || 0), 0);
        console.log(`💰 Total betting amount: ₱${totalAmount.toLocaleString()}`);
      }

      // Fetch entries directly from database
      console.log('📥 Fetching entries data from database...');
      const entries = await ChickenFightEntry.find({
        createdAt: { $gte: today, $lt: tomorrow }
      }).sort({ createdAt: -1 });

      // Try to fetch external betting data
      let externalData = null;
      try {
        console.log('🌐 Fetching external chicken fight betting...');
        externalData = await fetchChickenFightBettingData();
        if (externalData && !externalData.error) {
          console.log(`✅ External: ${externalData.totalBets} bets, ₱${externalData.totalAmount?.toLocaleString()}, status: ${externalData.bettingStatus}`);
        } else {
          console.warn('⚠️ External error:', externalData?.error);
          externalData = null;
        }
      } catch (err) {
        console.warn('⚠️ External fetch failed:', err.message);
      }

      // Combine database and external data
      const updateData = {
        currentFight: externalData?.currentFight || fightsData.fightNumber || 0,
        fights: fightsData.fights || [],
        bets: bets || [],
        entries: entries || [],
        bettingStatus: externalData?.bettingStatus || fightsData.bettingStatus || 'open',
        externalTotalBets: externalData?.totalBets || 0,
        externalTotalAmount: externalData?.totalAmount || 0,
        lastUpdate: new Date().toISOString()
      };

      console.log(`✅ Successfully fetched chicken fight data: ${updateData.bets.length} internal bets, ${updateData.externalTotalBets} external bets, status: ${updateData.bettingStatus}`);

      // Emit chicken fight update to connected clients
      emitChickenFightUpdate(io, updateData);

      console.log('📡 Live chicken fight update emitted to all connected clients');

    } catch (error) {
      console.error('❌ Chicken fight update scheduler error:', error.message);
      // Don't throw error, just log it to keep scheduler running
    }
  };

  // Initial fetch
  fetchAndEmitUpdates();

  // Set up periodic updates every 5 seconds (same as leaderboard)
  updateInterval = setInterval(fetchAndEmitUpdates, 5000);

  console.log('🐔 Chicken fight update scheduler started - updating every 5 seconds');

  return {
    stop: () => {
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
        isRunning = false;
        console.log('🐔 Chicken fight update scheduler stopped');
      }
    }
  };
}

export default initChickenFightUpdateScheduler;