// Test script to verify leaderboard integration
import { leaderboardService } from './frontend/src/services/leaderboardService.js';

async function testLeaderboardIntegration() {
  console.log('🧪 Testing Leaderboard Integration...');

  try {
    // Test fetching leaderboard data
    console.log('📊 Fetching leaderboard data...');
    const draws = await leaderboardService.fetchLeaderboardData();
    console.log(`✅ Successfully fetched ${draws.length} draws`);

    // Test getting statistics
    console.log('📈 Calculating statistics...');
    const stats = await leaderboardService.getBettingStats();
    console.log('✅ Statistics calculated:', stats);

    // Test getting current draw
    console.log('🎯 Getting current draw...');
    const currentDraw = await leaderboardService.getCurrentDraw();
    if (currentDraw) {
      console.log('✅ Current draw found:', currentDraw.id);
    } else {
      console.log('ℹ️ No current draw in progress');
    }

    // Test getting latest completed draw
    console.log('🏆 Getting latest completed draw...');
    const latestDraw = await leaderboardService.getLatestCompletedDraw();
    if (latestDraw) {
      console.log('✅ Latest completed draw:', latestDraw.id, latestDraw.result1);
    } else {
      console.log('ℹ️ No completed draws found');
    }

    console.log('🎉 All leaderboard integration tests passed!');

  } catch (error) {
    console.error('❌ Leaderboard integration test failed:', error);
  }
}

// Run the test
testLeaderboardIntegration();