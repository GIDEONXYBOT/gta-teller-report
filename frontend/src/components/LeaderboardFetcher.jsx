import React, { useState, useEffect } from 'react';
import { leaderboardService } from '../services/leaderboardService';

const LeaderboardFetcher = () => {
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [drawsData, statsData] = await Promise.all([
        leaderboardService.fetchLeaderboardData(),
        leaderboardService.getBettingStats()
      ]);

      setDraws(drawsData);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-4">Loading leaderboard data...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        Error: {error}
        <button
          onClick={fetchData}
          className="ml-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Leaderboard Data</h2>

      {stats && (
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <h3 className="text-lg font-semibold mb-2">Summary Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>Total Draws: {stats.totalDraws}</div>
            <div>Total Bets: {stats.totalBets}</div>
            <div>Total Bet Amount: ₱{stats.totalBetAmount.toLocaleString()}</div>
            <div>Total Won: ₱{stats.totalWonAmount.toLocaleString()}</div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {draws.slice(0, 10).map((draw) => (
          <div key={draw.id} className="border rounded p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Draw #{draw.id}</h3>
              <span className={`px-2 py-1 rounded text-sm ${
                draw.status === 'completed' ? 'bg-green-100 text-green-800' :
                draw.status === 'started' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {draw.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>Result: <strong>{draw.result1 || 'Pending'}</strong></div>
              <div>Total Bets: {draw.totalBets}</div>
              <div>Bet Amount: ₱{draw.totalBetAmount}</div>
              <div>Won Amount: ₱{draw.totalWonAmount}</div>
            </div>

            {draw.details && (
              <div className="mt-2 text-sm text-gray-600">
                <div>Red Odds: {draw.details.formattedRedOdds}</div>
                <div>Blue Odds: {draw.details.formattedBlueOdds}</div>
                <div>Draw Odds: {draw.details.formattedDrawOdds}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={fetchData}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Refresh Data
      </button>
    </div>
  );
};

export default LeaderboardFetcher;