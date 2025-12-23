import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PublicLeaderboard = () => {
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch from production API - only returns today's data by default
      const response = await axios.get('https://rmi-backend-zhdr.onrender.com/api/external-betting/leaderboard');
      const todaysDraws = response.data.data || [];

      console.log(`Loaded ${todaysDraws.length} fights for today from backend`);
      setDraws(todaysDraws);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching leaderboard data:', err);
      setError('Failed to load fight data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Refresh every 60 seconds (reduced frequency)
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading today's fight results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900 border border-red-700 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold text-red-200 mb-2">Unable to Load Data</h2>
            <p className="text-red-300">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate today's statistics
  const totalFights = draws.length;
  const completedFights = draws.filter(d => d.result1 && d.result1 !== 'draw').length;
  const totalCommission = draws.reduce((total, draw) => {
    if (draw.details && draw.result1 && draw.result1 !== 'draw') {
      const fightTotal = draw.details.redTotalBetAmount + draw.details.blueTotalBetAmount + (draw.details.drawTotalBetAmount || 0);
      return total + (fightTotal * 0.055);
    }
    return total;
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-purple-900 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">RMI Chicken Fight Results</h1>
            <p className="text-blue-200 text-lg">Today's Live Fight Results</p>
          </div>

          {/* Today's Stats */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-white">{totalFights}</div>
              <div className="text-blue-200">Total Fights Today</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-green-400">{completedFights}</div>
              <div className="text-blue-200">Completed Fights</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-yellow-400">{formatCurrency(totalCommission)}</div>
              <div className="text-blue-200">Total Commission</div>
            </div>
          </div>

          {lastUpdated && (
            <div className="text-center mt-4 text-sm text-blue-300">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Fight Results */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Fight Numbers Grid Pattern */}
        {draws.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Today's Fight Numbers</h2>
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
              <div className="grid grid-cols-7 gap-3 justify-center max-w-2xl">
                {draws.slice(0, 16).map((draw, idx) => (
                  <div
                    key={draw.id}
                    className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 border-2 border-blue-400 shadow-lg hover:shadow-blue-500/50 transition-all hover:scale-110 cursor-pointer"
                  >
                    <span className="text-white font-bold text-lg">
                      {draw.batch?.fightSequence || draw.id}
                    </span>
                  </div>
                ))}
              </div>
              {draws.length > 16 && (
                <div className="text-center text-gray-400 text-sm mt-6">
                  Showing first 16 fights (Total: {draws.length})
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {draws.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">No fights completed today yet.</p>
              <p className="text-gray-500 text-sm mt-2">Check back later for live results!</p>
            </div>
          ) : (
            draws.map((draw) => (
              <div key={draw.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl font-bold text-gray-300">
                      Fight #{draw.batch?.fightSequence || draw.id}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      draw.result1 === 'red' ? 'bg-red-900 text-red-200' :
                      draw.result1 === 'blue' ? 'bg-blue-900 text-blue-200' :
                      draw.result1 === 'draw' ? 'bg-green-900 text-green-200' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {draw.result1 ? (draw.result1 === 'red' ? 'MERON' : draw.result1 === 'blue' ? 'WALA' : draw.result1.toUpperCase()) : 'PENDING'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">
                      {formatTime(draw.createdAt)}
                    </div>
                  </div>
                </div>

                {draw.details && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-gray-700 rounded p-3">
                      <div className="text-red-400 font-semibold">MERON (Red)</div>
                      <div className="text-white">₱{draw.details.redTotalBetAmount?.toLocaleString() || '0'}</div>
                      <div className="text-gray-400 text-xs">Odds: {draw.details.redOdds || 'N/A'}</div>
                    </div>
                    <div className="bg-gray-700 rounded p-3">
                      <div className="text-blue-400 font-semibold">WALA (Blue)</div>
                      <div className="text-white">₱{draw.details.blueTotalBetAmount?.toLocaleString() || '0'}</div>
                      <div className="text-gray-400 text-xs">Odds: {draw.details.blueOdds || 'N/A'}</div>
                    </div>
                    <div className="bg-gray-700 rounded p-3">
                      <div className="text-green-400 font-semibold">DRAW</div>
                      <div className="text-white">₱{draw.details.drawTotalBetAmount?.toLocaleString() || '0'}</div>
                      <div className="text-gray-400 text-xs">Odds: {draw.details.drawOdds || 'N/A'}</div>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-600">
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Total Bets: ₱{draw.details ? (draw.details.redTotalBetAmount + draw.details.blueTotalBetAmount + (draw.details.drawTotalBetAmount || 0)).toLocaleString() : '0'}</span>
                    {draw.result1 && draw.result1 !== 'draw' && draw.details && (
                      <span>Commission: ₱{((draw.details.redTotalBetAmount + draw.details.blueTotalBetAmount + (draw.details.drawTotalBetAmount || 0)) * 0.055).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 border-t border-gray-700 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-gray-400 text-sm">
          <p>RMI Teller Report System - Today's Chicken Fight Results</p>
          <p className="mt-1">Data updates automatically every minute</p>
        </div>
      </div>
    </div>
  );
};

export default PublicLeaderboard;