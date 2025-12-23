import React, { useState, useEffect, useRef } from 'react';
import { leaderboardService } from '../services/leaderboardService';
import { useToast } from '../context/ToastContext';
import { getSocket } from '../socket';

const LeaderboardPage = () => {
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [currentDraw, setCurrentDraw] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [coins, setCoins] = useState([]);
  const [lastTotalBets, setLastTotalBets] = useState(0);
  const { showToast } = useToast();

  // Monitor total bets and generate coins when it increases
  useEffect(() => {
    if (currentDraw?.details) {
      const currentTotal = currentDraw.details.redTotalBetAmount + 
                           currentDraw.details.blueTotalBetAmount + 
                           (currentDraw.details.drawTotalBetAmount || 0);
      
      if (currentTotal > lastTotalBets) {
        // Generate new coins (add more coins as bets increase)
        const coinIncrease = Math.min(Math.floor((currentTotal - lastTotalBets) / 1000), 15);
        const newCoins = Array.from({ length: coinIncrease }).map((_, i) => ({
          id: `${Date.now()}-${i}`,
          createdAt: Date.now(),
          animationStarted: false
        }));
        setCoins(prev => [...prev, ...newCoins]);
        setLastTotalBets(currentTotal);
      }
    }
  }, [currentDraw?.details, lastTotalBets]);

  // Don't clean up coins - let them accumulate
  useEffect(() => {
    // Just mark coins as done animating after they finish falling
    const timeout = setTimeout(() => {
      setCoins(prev => prev.map(coin => ({ ...coin, animationStarted: true })));
    }, 3500);
    return () => clearTimeout(timeout);
  }, [coins.length]);

  const fetchData = async (isBackground = false) => {
    if (isBackground) {
      setBackgroundLoading(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [drawsData, statsData, currentDrawData] = await Promise.all([
        leaderboardService.fetchLeaderboardData(),
        leaderboardService.getBettingStats(),
        leaderboardService.getCurrentDraw()
      ]);

      setDraws(drawsData);
      setStats(statsData);
      setCurrentDraw(currentDrawData);
      setLastUpdated(new Date());

      if (!isBackground) {
        showToast({
          type: 'success',
          message: `Loaded ${drawsData.length} draws from external leaderboard`
        });
      }
    } catch (err) {
      console.error('Error fetching leaderboard data:', err);
      if (!isBackground) {
        setError(err.message);
        showToast({
          type: 'error',
          message: 'Failed to load leaderboard data'
        });
      }
    } finally {
      if (isBackground) {
        setBackgroundLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Load initial data immediately without blocking UI
    fetchData(false);

    // Initialize socket connection for real-time updates
    const socketInstance = getSocket();
    setSocket(socketInstance);

    if (socketInstance) {
      socketInstance.on('connect', () => {
        console.log('🔌 Leaderboard socket connected');
        setIsConnected(true);
        
        // Subscribe to leaderboard and betting updates
        socketInstance.emit('subscribe-leaderboard');
        socketInstance.emit('subscribe-betting');
        
        // Fetch fresh data when socket connects
        fetchData(true);
      });

      socketInstance.on('disconnect', () => {
        console.log('🔌 Leaderboard socket disconnected');
        setIsConnected(false);
      });

      // Listen for leaderboard updates
      socketInstance.on('leaderboard-update', (data) => {
        console.log('📊 Leaderboard update received:', data);
        if (data.draws) setDraws(data.draws);
        if (data.currentDraw) setCurrentDraw(data.currentDraw);
        if (data.stats) setStats(data.stats);
        setLastUpdated(new Date());
      });

      // Listen for betting updates
      socketInstance.on('betting-update', (data) => {
        console.log('🎯 Betting update received:', data);
        if (data.currentDraw) {
          setCurrentDraw(data.currentDraw);
          setLastUpdated(new Date());
        }
      });

      // Background refresh every 2 seconds as fallback
      const interval = setInterval(() => {
        fetchData(true);
      }, 2000); // 2 seconds

      return () => {
        socketInstance.off('connect');
        socketInstance.off('disconnect');
        socketInstance.off('leaderboard-update');
        socketInstance.off('betting-update');
        clearInterval(interval);
      };
    }
  }, []);

  // Live clock that updates every second
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCurrentTime = () => {
    return new Date().toLocaleString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const getCurrentDate = () => {
    return new Date().toLocaleString('en-PH', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).toUpperCase();
  };

  const getStreakCount = (draws, ...targetResults) => {
    let streak = 0;
    for (let i = 0; i < Math.min(draws.length, 20); i++) {
      const result = draws[i].result1;
      const isTarget = targetResults.some(target => 
        result === target || 
        (target === 'meron' && result === 'red') || 
        (target === 'wala' && result === 'blue')
      );
      if (isTarget) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  if (loading && draws.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-lg">Loading leaderboard data...</span>
        </div>
      </div>
    );
  }

  if (error && draws.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="bg-red-900 border border-red-700 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-200">Error Loading Data</h3>
              <div className="mt-2 text-sm text-red-300">{error}</div>
              <div className="mt-4">
                <button
                  onClick={() => fetchData(false)}
                  className="bg-red-800 hover:bg-red-700 text-red-200 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans flex">
      {/* Sidebar - Fight Results */}
      <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">FIGHT RESULTS</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchData(true)}
                disabled={backgroundLoading}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                ↻
              </button>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-1 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span>{isConnected ? 'Live Updates' : 'Online'}</span>
              {backgroundLoading && (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border border-gray-500 border-t-transparent"></div>
                  <span className="ml-1">Updating...</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-green-400 font-medium">
                Total Comm: {formatCurrency(draws.reduce((total, draw) => {
                  if (draw.details && draw.result1 && draw.result1 !== 'draw') {
                    const fightTotal = draw.details.redTotalBetAmount + draw.details.blueTotalBetAmount + (draw.details.drawTotalBetAmount || 0);
                    return total + (fightTotal * 0.055);
                  }
                  return total;
                }, 0))}
              </div>
              <div className="text-xs text-blue-400 font-mono">
                🕐 {currentTime.toLocaleTimeString()}
              </div>
              {lastUpdated && (
                <div className="text-xs text-gray-500">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {draws.slice(0, 300).map((draw, index) => (
            <div key={draw.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-medium text-gray-300">
                  Fight #{draw.batch?.fightSequence || draw.id}
                </div>
                <div className={`text-sm font-bold ${
                  draw.result1 === 'red' ? 'text-red-400' :
                  draw.result1 === 'blue' ? 'text-blue-400' :
                  draw.result1 === 'draw' ? 'text-green-400' :
                  'text-gray-400'
                }`}>
                  {draw.result1 ? (draw.result1 === 'red' ? 'MERON' : draw.result1 === 'blue' ? 'WALA' : draw.result1.toUpperCase()) : 'CANCEL'}
                </div>
              </div>
              <div className="text-xs text-gray-500 mb-1">
                {new Date(draw.createdAt).toLocaleTimeString('en-PH', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Total: ₱{draw.details ? (draw.details.redTotalBetAmount + draw.details.blueTotalBetAmount + (draw.details.drawTotalBetAmount || 0)).toLocaleString() : '0'}</span>
                {draw.result1 && draw.result1 !== 'draw' ? (
                  <span>Comm: ₱{draw.details ? ((draw.details.redTotalBetAmount + draw.details.blueTotalBetAmount + (draw.details.drawTotalBetAmount || 0)) * 0.055).toFixed(2) : '0.00'}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <div className="text-xs text-gray-500 text-center">
            Last updated: {getCurrentTime()}
          </div>
        </div>
      </div>

      {/* Main Content - Current Fight */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
          <div className="flex justify-between items-center max-w-6xl mx-auto">
            <div className="flex items-center space-x-6">
              <div className="text-xl font-bold text-white">
                {getCurrentTime()}
              </div>
              <div className="text-sm text-gray-400">
                {getCurrentDate()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-400">
                RMI FRIDAY - 90 FIGHTS
              </div>
              <div className="text-xs text-gray-500">
                DECEMBER 19, 2025 MINIMUM BET 100
              </div>
            </div>
          </div>
        </div>

        {/* Current Fight Betting - Top Section */}
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            {currentDraw ? (
              <div className="bg-gray-900 rounded-lg p-8 border border-gray-700 mb-8 relative overflow-hidden">
                {/* Falling Coins Animation Container - Behind Content */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg" style={{ zIndex: 5 }}>
                  <style>{`
                    @keyframes fallCoin1 {
                      0% {
                        transform: translateY(-100px) translateX(-120px) rotateX(0deg) rotateZ(0deg) rotateY(0deg);
                        opacity: 1;
                      }
                      100% {
                        transform: translateY(calc(100% - 0px)) translateX(-80px) rotateX(900deg) rotateZ(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg);
                        opacity: 1;
                      }
                    }
                    @keyframes fallCoin2 {
                      0% {
                        transform: translateY(-100px) translateX(-40px) rotateX(0deg) rotateZ(0deg) rotateY(0deg);
                        opacity: 1;
                      }
                      100% {
                        transform: translateY(calc(100% - 0px)) translateX(-10px) rotateX(900deg) rotateZ(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg);
                        opacity: 1;
                      }
                    }
                    @keyframes fallCoin3 {
                      0% {
                        transform: translateY(-100px) translateX(40px) rotateX(0deg) rotateZ(0deg) rotateY(0deg);
                        opacity: 1;
                      }
                      100% {
                        transform: translateY(calc(100% - 0px)) translateX(40px) rotateX(900deg) rotateZ(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg);
                        opacity: 1;
                      }
                    }
                    @keyframes fallCoin4 {
                      0% {
                        transform: translateY(-100px) translateX(120px) rotateX(0deg) rotateZ(0deg) rotateY(0deg);
                        opacity: 1;
                      }
                      100% {
                        transform: translateY(calc(100% - 0px)) translateX(80px) rotateX(900deg) rotateZ(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg);
                        opacity: 1;
                      }
                    }
                    .falling-coin {
                      position: absolute;
                      font-size: 2.8rem;
                      left: 50%;
                      margin-left: -1.4rem;
                      top: 0;
                      text-shadow: 0 0 12px rgba(255, 215, 0, 0.6);
                      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
                    }
                    .falling-coin.coin-1 {
                      animation: fallCoin1 1.8s ease-in forwards;
                    }
                    .falling-coin.coin-2 {
                      animation: fallCoin2 1.8s ease-in forwards;
                    }
                    .falling-coin.coin-3 {
                      animation: fallCoin3 1.8s ease-in forwards;
                    }
                    .falling-coin.coin-4 {
                      animation: fallCoin4 1.8s ease-in forwards;
                    }
                    .coins-pile {
                      position: absolute;
                      bottom: 0;
                      left: 50%;
                      width: 300px;
                      height: 160px;
                      margin-left: -150px;
                      display: block;
                    }
                    .coin-settled {
                      position: absolute;
                      font-size: 2.8rem;
                      opacity: 0.95;
                      text-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
                      filter: drop-shadow(2px 2px 5px rgba(0, 0, 0, 0.6));
                      animation: none !important;
                      transform: none !important;
                    }
                  `}</style>
                  
                  {/* Animating coins - spread out falling */}
                  {coins.map((coin, index) => {
                    const coinPattern = index % 4;
                    return (
                      !coin.animationStarted && (
                        <div
                          key={coin.id}
                          className={`falling-coin coin-${(coinPattern % 4) + 1}`}
                          style={{
                            animationDelay: `${(index % 4) * 0.15}s`,
                            zIndex: 20
                          }}
                        >
                          🪙
                        </div>
                      )
                    );
                  })}
                  
                  {/* Accumulated coins at bottom - Stack upward randomly */}
                  <div className="coins-pile">
                    {coins.map((coin, index) => {
                      if (!coin.animationStarted) return null;
                      
                      // Stack coins upward from bottom with random positions and orientations
                      const randomX = Math.random() * 260; // Random horizontal position within pile
                      const randomY = Math.floor(Math.random() * 5) * 32; // Stack in layers (0, 32, 64, 96, 128px)
                      
                      // Multiple rotation axes for varied coin orientations
                      const rotateZ = Math.random() * 360; // Full rotation around Z axis
                      const rotateX = Math.random() * 180 - 90; // Front/back tilt (-90 to 90)
                      const rotateY = Math.random() * 180; // Side flip (0 to 180 - shows edge/side)
                      
                      return (
                        <div 
                          key={`settled-${coin.id}`} 
                          className="coin-settled"
                          style={{
                            left: `${randomX}px`,
                            bottom: `${randomY}px`,
                            transform: `perspective(600px) rotateZ(${rotateZ}deg) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
                            zIndex: index,
                            position: 'absolute'
                          }}
                        >
                          🪙
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rooster Fighting Visualization */}
                <div className="relative z-10 mb-8 flex justify-center items-center h-40">
                  <style>{`
                    @keyframes roosterLeftFight {
                      0% { 
                        transform: translateX(-80px) translateY(0) scaleX(-1) rotateZ(0deg);
                        opacity: 1;
                      }
                      15% { 
                        transform: translateX(-40px) translateY(-20px) scaleX(-1) rotateZ(-15deg);
                        opacity: 1;
                      }
                      30% { 
                        transform: translateX(0px) translateY(0px) scaleX(-1) rotateZ(-25deg);
                        opacity: 1;
                      }
                      45% { 
                        transform: translateX(-20px) translateY(-30px) scaleX(-1) rotateZ(-20deg);
                        opacity: 1;
                      }
                      60% { 
                        transform: translateX(-60px) translateY(-15px) scaleX(-1) rotateZ(-10deg);
                        opacity: 1;
                      }
                      75% { 
                        transform: translateX(-40px) translateY(0px) scaleX(-1) rotateZ(-5deg);
                        opacity: 1;
                      }
                      100% { 
                        transform: translateX(-80px) translateY(0) scaleX(-1) rotateZ(0deg);
                        opacity: 1;
                      }
                    }
                    @keyframes roosterRightFight {
                      0% { 
                        transform: translateX(80px) translateY(0) rotateZ(0deg);
                        opacity: 1;
                      }
                      15% { 
                        transform: translateX(40px) translateY(-20px) rotateZ(15deg);
                        opacity: 1;
                      }
                      30% { 
                        transform: translateX(0px) translateY(0px) rotateZ(25deg);
                        opacity: 1;
                      }
                      45% { 
                        transform: translateX(20px) translateY(-30px) rotateZ(20deg);
                        opacity: 1;
                      }
                      60% { 
                        transform: translateX(60px) translateY(-15px) rotateZ(10deg);
                        opacity: 1;
                      }
                      75% { 
                        transform: translateX(40px) translateY(0px) rotateZ(5deg);
                        opacity: 1;
                      }
                      100% { 
                        transform: translateX(80px) translateY(0) rotateZ(0deg);
                        opacity: 1;
                      }
                    }
                    @keyframes wingFlap {
                      0%, 100% { opacity: 1; }
                      20% { opacity: 0.4; }
                      40% { opacity: 1; }
                      60% { opacity: 0.4; }
                      80% { opacity: 1; }
                    }
                    .rooster-left {
                      animation: roosterLeftFight 2s ease-in-out infinite, wingFlap 2s ease-in-out infinite;
                      font-size: 6rem;
                      filter: drop-shadow(0 0 10px rgba(255, 0, 0, 0.3));
                    }
                    .rooster-right {
                      animation: roosterRightFight 2s ease-in-out infinite, wingFlap 2s ease-in-out infinite;
                      font-size: 6rem;
                      filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.3));
                    }
                    .fight-label {
                      font-size: 1.2rem;
                      font-weight: bold;
                      color: #ef4444;
                      text-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
                      position: absolute;
                      top: 0;
                    }
                  `}</style>
                  <div className="fight-label">⚡ LIVE FIGHT ⚡</div>
                  <div className="rooster-left">🐓</div>
                  <div className="rooster-right">🐓</div>
                </div>

                {/* Fight Header */}
                <div className="text-center mb-8 relative z-10">
                  <div className="text-6xl font-bold text-white mb-4">
                    CURRENT FIGHT
                  </div>
                  <div className="text-2xl text-gray-300 mb-4">
                    {currentDraw.status === 'completed' ? `RESULT: ${(currentDraw.result1 === 'red' ? 'MERON' : currentDraw.result1 === 'blue' ? 'WALA' : currentDraw.result1?.toUpperCase()) || 'PENDING'}` : 'LIVE BETTING'}
                  </div>
                  <div className={`text-xl font-bold ${currentDraw.status === 'started' ? 'text-green-400' : 'text-gray-400'}`}>
                    {currentDraw.status === 'started' ? 'BETTING IS OPEN' : 'BETTING CLOSED'}
                  </div>
                </div>

                {/* Betting Options */}
                <div className="grid grid-cols-3 gap-8 mb-8 relative z-10">
                  {/* Meron (Red) */}
                  <div className="bg-red-600 hover:bg-red-500 rounded-lg p-6 text-center cursor-pointer transition-all duration-300 border-4 border-red-500 transform hover:scale-105">
                    <div className="text-3xl font-bold text-white mb-4">MERON</div>
                    <div className="text-2xl text-red-100 font-semibold mb-2">
                      {currentDraw.details?.formattedRedOdds || '1.47'}
                    </div>
                    <div className="text-lg text-red-200">
                      ₱{currentDraw.details?.redTotalBetAmount?.toLocaleString() || '0'}
                    </div>
                  </div>

                  {/* Draw */}
                  <div className="bg-green-600 hover:bg-green-500 rounded-lg p-6 text-center cursor-pointer transition-all duration-300 border-4 border-green-500 transform hover:scale-105">
                    <div className="text-3xl font-bold text-white mb-4">DRAW</div>
                    <div className="text-2xl text-green-100 font-semibold mb-2">
                      {currentDraw.details?.formattedDrawOdds || '8.00'}
                    </div>
                    <div className="text-lg text-green-200">
                      ₱{currentDraw.details?.drawTotalBetAmount?.toLocaleString() || '0'}
                    </div>
                  </div>

                  {/* Wala (Blue) */}
                  <div className="bg-blue-600 hover:bg-blue-500 rounded-lg p-6 text-center cursor-pointer transition-all duration-300 border-4 border-blue-500 transform hover:scale-105">
                    <div className="text-3xl font-bold text-white mb-4">WALA</div>
                    <div className="text-2xl text-blue-100 font-semibold mb-2">
                      {currentDraw.details?.formattedBlueOdds || '2.63'}
                    </div>
                    <div className="text-lg text-blue-200">
                      ₱{currentDraw.details?.blueTotalBetAmount?.toLocaleString() || '0'}
                    </div>
                  </div>
                </div>

                {/* Live Stats */}
                <div className="text-center relative z-10">
                  <div className="text-sm text-gray-400 mb-2">TOTAL BETS</div>
                  <div className="text-2xl font-bold text-white">
                    ₱{currentDraw.details ? (currentDraw.details.redTotalBetAmount + currentDraw.details.blueTotalBetAmount + (currentDraw.details.drawTotalBetAmount || 0)).toLocaleString() : '0'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-lg p-8 border border-gray-700 mb-8">
                <div className="text-center text-gray-400">
                  <div className="text-2xl mb-4">No Active Fight</div>
                  <div className="text-lg">Waiting for next fight to begin...</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Pattern Card */}
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white">FIGHT HISTORY PATTERN</h3>
                <div className="text-sm text-gray-400 mt-1">Recent fight results</div>
              </div>

              {/* Bead Plate Pattern - Traditional Baccarat Style */}
              <div className="bg-gray-800 rounded-lg p-4 max-w-5xl mx-auto">
                <div className="text-center mb-4">
                  <h4 className="text-lg font-semibold text-white">REGLA PATTERN</h4>
                  <div className="text-xs text-gray-400">Each column shows consecutive wins of the same result</div>
                </div>

                {/* Regla Pattern - Streak-based Layout */}
                <div className="relative max-w-6xl mx-auto">
                  {/* Generate Regla Pattern - Auto-adjust to show all results from oldest to newest */}
                  {(() => {
                    const totalRows = 6;
                    const totalColumns = 60;
                    const maxBeads = totalRows * totalColumns;

                    // Get all draws and sort by fight number (oldest first)
                    const allDraws = [...draws]
                      .sort((a, b) => {
                        const fightA = a.batch?.fightSequence || a.id || 0;
                        const fightB = b.batch?.fightSequence || b.id || 0;
                        return fightA - fightB; // Sort ascending (1, 2, 3...)
                      })
                      .slice(0, maxBeads); // Limit to max capacity

                    return (
                      <div className="flex justify-center gap-1 overflow-x-auto pb-4">
                        {/* Create 60 columns */}
                        {Array.from({ length: totalColumns }, (_, columnIndex) => (
                          <div key={columnIndex} className="flex flex-col gap-1">
                            {/* Column header - show fight range */}
                            {columnIndex % 10 === 0 && (
                              <div className="text-center text-xs text-gray-500 mb-1">
                                {columnIndex * totalRows + 1}-{Math.min((columnIndex + 1) * totalRows, allDraws.length)}
                              </div>
                            )}

                            {/* 6 rows per column */}
                            {Array.from({ length: totalRows }, (_, rowIndex) => {
                              // Calculate the bead index in the sequence (left to right, top to bottom)
                              const beadIndex = columnIndex * totalRows + rowIndex;

                              // Get the draw for this position (oldest first)
                              const draw = allDraws[beadIndex];
                              const result = draw?.result1;

                              // Normalize result
                              const normalizedResult = result === 'meron' || result === 'red' ? 'meron' :
                                                     result === 'wala' || result === 'blue' ? 'wala' :
                                                     result === 'draw' ? 'draw' : 'cancel';

                              const fightNumber = draw?.batch?.fightSequence || draw?.id;
                              const isMeron = normalizedResult === 'meron';
                              const isWala = normalizedResult === 'wala';
                              const isDraw = normalizedResult === 'draw';
                              const isCancel = normalizedResult === 'cancel';

                              return (
                                <div
                                  key={`${columnIndex}-${rowIndex}`}
                                  className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                                    draw ? (
                                      isMeron ? 'bg-red-600 border-red-500 text-white' :
                                      isWala ? 'bg-blue-600 border-blue-500 text-white' :
                                      isDraw ? 'bg-green-600 border-green-500 text-white' :
                                      'bg-gray-600 border-gray-500 text-gray-300'
                                    ) : 'border-gray-700 bg-gray-800'
                                  }`}
                                  title={draw ? `Fight ${fightNumber}: ${normalizedResult.toUpperCase()}` : 'No result'}
                                >
                                  {draw ? (fightNumber > 99 ? '..' : fightNumber) : ''}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Pattern Statistics */}
                <div className="mt-4 grid grid-cols-4 gap-4 text-center text-sm">
                  <div className="bg-red-900 bg-opacity-50 rounded p-2">
                    <div className="text-red-300 font-bold text-lg">
                      {draws.slice(0, 100).filter(d => d.result1 === 'meron' || d.result1 === 'red').length}
                    </div>
                    <div className="text-red-400 text-xs">Meron</div>
                  </div>
                  <div className="bg-blue-900 bg-opacity-50 rounded p-2">
                    <div className="text-blue-300 font-bold text-lg">
                      {draws.slice(0, 100).filter(d => d.result1 === 'wala' || d.result1 === 'blue').length}
                    </div>
                    <div className="text-blue-400 text-xs">Wala</div>
                  </div>
                  <div className="bg-green-900 bg-opacity-50 rounded p-2">
                    <div className="text-green-300 font-bold text-lg">
                      {draws.slice(0, 100).filter(d => d.result1 === 'draw').length}
                    </div>
                    <div className="text-green-400 text-xs">Draw</div>
                  </div>
                  <div className="bg-gray-900 bg-opacity-50 rounded p-2">
                    <div className="text-gray-300 font-bold text-lg">
                      {draws.slice(0, 100).filter(d => !d.result1 || d.result1 === 'cancel').length}
                    </div>
                    <div className="text-gray-400 text-xs">Cancel</div>
                  </div>
                </div>

                {/* Trend Indicators */}
                <div className="mt-4 text-center text-xs text-gray-400">
                  <div className="flex justify-center space-x-4">
                    <span>🔴 Meron Streak: {getStreakCount(draws, 'meron', 'red')}</span>
                    <span>🔵 Wala Streak: {getStreakCount(draws, 'wala', 'blue')}</span>
                    <span>🟢 Draw Streak: {getStreakCount(draws, 'draw')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Message */}
        <div className="text-center py-4 text-sm text-gray-500 border-t border-gray-800">
          Payout less than 1.40 shall be canceled • Live updates every few seconds
        </div>
      </div>

      {/* Refresh Button */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={fetchData}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 shadow-lg text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>REFRESH</span>
        </button>
      </div>
    </div>
  );
};

export default LeaderboardPage;