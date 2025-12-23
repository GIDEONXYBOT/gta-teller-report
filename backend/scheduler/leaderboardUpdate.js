// scheduler/leaderboardUpdate.js - Periodic leaderboard data fetching and real-time updates
import axios from 'axios';
import * as cheerio from 'cheerio';
import { emitLeaderboardUpdate } from '../socket/leaderboardSocket.js';

let updateInterval = null;
let isRunning = false;

// Fallback scraping function in case API fails
const fallbackScraping = async (io) => {
  try {
    const client = axios.create();
    const leaderboardUrl = 'https://rmi-gideon.gtarena.ph/leaderboard';

    const response = await client.get(leaderboardUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    if (response.status !== 200) return;

    const $ = cheerio.load(response.data);
    const draws = [];

    // Try to find data-page attribute first (same as externalBetting.js)
    const dataPage = $('#app').attr('data-page');
    if (dataPage) {
      try {
        const pageData = JSON.parse(dataPage.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
        if (pageData?.props?.draws) {
          const apiDraws = pageData.props.draws;
          console.log(`✅ Fallback found ${apiDraws.length} draws in data-page`);

          emitLeaderboardUpdate(io, {
            draws: apiDraws,
            currentDraw: apiDraws[0] || null,
            totalDraws: apiDraws.length
          });
          return;
        }
      } catch (e) {
        console.warn('⚠️ Failed to parse data-page in fallback');
      }
    }

    // Alternative parsing if data-page fails
    $('tr, .fight, [class*="fight"]').each((index, element) => {
      try {
        const $row = $(element);
        const text = $row.text();
        const numbers = text.match(/[\d,]+\.?\d*/g);
        if (numbers && numbers.length >= 3) {
          draws.push({
            id: `fallback-draw-${index}`,
            result1: null,
            result2: null,
            details: {
              redTotalBetAmount: parseFloat(numbers[0].replace(/,/g, '')) || 0,
              blueTotalBetAmount: parseFloat(numbers[1].replace(/,/g, '')) || 0,
              drawTotalBetAmount: parseFloat(numbers[2].replace(/,/g, '')) || 0
            },
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        // Ignore parsing errors
      }
    });

    if (draws.length > 0) {
      console.log(`✅ Fallback scraping found ${draws.length} draws`);
      emitLeaderboardUpdate(io, {
        draws: draws,
        currentDraw: draws[0] || null,
        totalDraws: draws.length
      });
    }
  } catch (error) {
    console.error('❌ Fallback scraping failed:', error.message);
  }
};

export function initLeaderboardUpdateScheduler(io) {
  if (isRunning) {
    console.log('📊 Leaderboard update scheduler already running');
    return;
  }

  isRunning = true;
  console.log('📊 Starting leaderboard update scheduler...');

  // Function to fetch and emit leaderboard updates
  const fetchAndEmitUpdates = async () => {
    try {
      console.log('🔄 Fetching leaderboard data for live updates...');

      // Use the externalBetting API endpoint instead of direct scraping
      const apiUrl = 'http://localhost:5000/api/external-betting/leaderboard';
      console.log(`📡 Calling internal API: ${apiUrl}`);

      const response = await axios.get(apiUrl, {
        timeout: 15000,
        validateStatus: () => true
      });

      if (response.status === 200 && response.data) {
        const { data: draws, totalDraws } = response.data;

        if (draws && draws.length > 0) {
          console.log(`✅ Successfully received ${draws.length} draws from API`);

          // Emit leaderboard update to connected clients
          emitLeaderboardUpdate(io, {
            draws: draws,
            currentDraw: draws[0] || null, // Most recent draw
            totalDraws: totalDraws || draws.length
          });

          console.log('📡 Live leaderboard update emitted to all connected clients');
        } else {
          console.warn('⚠️ No draws received from API');
        }
      } else {
        console.error(`❌ API call failed with status ${response.status}:`, response.data);
      }

    } catch (error) {
      console.error('❌ Leaderboard update scheduler error:', error.message);

      // Fallback to direct scraping if API fails
      console.log('🔄 Falling back to direct HTML scraping...');
      await fallbackScraping(io);
    }
  };

  // Initial fetch
  fetchAndEmitUpdates();

  // Set up periodic updates every 5 seconds (instead of 30)
  updateInterval = setInterval(fetchAndEmitUpdates, 5000);

  console.log('📊 Leaderboard update scheduler started - updating every 5 seconds');

  return {
    stop: () => {
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
        isRunning = false;
        console.log('📊 Leaderboard update scheduler stopped');
      }
    }
  };
}

export default initLeaderboardUpdateScheduler;