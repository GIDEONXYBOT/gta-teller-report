import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext';
import { getApiUrl } from '../utils/apiConfig';
import { getGlobalSocket } from '../utils/globalSocket';
import { FadeInUp, ScaleIn, StaggerContainer, StaggerItem, Pulse } from './UIEffects';
import { useNavigate } from 'react-router-dom';

export default function LiveChickenFightDashboard() {
  const { isDarkMode } = useContext(SettingsContext);
  const navigate = useNavigate();
  const [liveData, setLiveData] = useState({
    currentFight: null,
    fights: [],
    bets: [],
    entries: [],
    bettingStatus: 'open',
    externalTotalBets: 0,
    externalTotalAmount: 0,
    lastUpdate: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Format large numbers properly
  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    if (num >= 1000000) {
      return `₱${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `₱${(num / 1000).toFixed(1)}K`;
    } else {
      return `₱${num.toLocaleString()}`;
    }
  };

  // Check authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token found, redirecting to login');
      navigate('/login');
      return;
    }

    // Optional: Verify token validity
    const verifyToken = async () => {
      try {
        await axios.get(`${getApiUrl()}/api/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.log('Token invalid, redirecting to login');
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
    };

    verifyToken();
  }, [navigate]);

  // Live clock that updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load initial data
  const loadLiveData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [fightsRes, betsRes, entriesRes] = await Promise.all([
        axios.get(`${getApiUrl()}/api/chicken-fight/fights/today`, { headers }),
        axios.get(`${getApiUrl()}/api/chicken-fight/bets?gameDate=${new Date().toISOString().split('T')[0]}`, { headers }),
        axios.get(`${getApiUrl()}/api/chicken-fight/entries`, { headers })
      ]);

      setLiveData({
        currentFight: fightsRes.data.fightNumber || 0,
        fights: fightsRes.data.fights || [],
        bets: betsRes.data.bets || [],
        entries: entriesRes.data.entries || [],
        lastUpdate: new Date()
      });
    } catch (err) {
      console.error('Failed to load live data:', err);
      
      // Check if it's an authentication error
      if (err.response && err.response.status === 401) {
        console.log('Authentication failed, redirecting to login');
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      
      setError('Failed to load live data');
    } finally {
      setLoading(false);
    }
  };

  // Background update function (doesn't show loading)
  const updateLiveData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [fightsRes, betsRes, entriesRes] = await Promise.all([
        axios.get(`${getApiUrl()}/api/chicken-fight/fights/today`, { headers }),
        axios.get(`${getApiUrl()}/api/chicken-fight/bets?gameDate=${new Date().toISOString().split('T')[0]}`, { headers }),
        axios.get(`${getApiUrl()}/api/chicken-fight/entries`, { headers })
      ]);

      setLiveData({
        currentFight: fightsRes.data.fightNumber || 0,
        fights: fightsRes.data.fights || [],
        bets: betsRes.data.bets || [],
        entries: entriesRes.data.entries || [],
        lastUpdate: new Date()
      });
    } catch (err) {
      console.error('Failed to update live data:', err);
      // Don't set error state for background updates
    }
  };

  // Set up real-time updates
  useEffect(() => {
    loadLiveData();

    const socket = getGlobalSocket();
    if (socket) {
      // Listen for live chicken fight updates
      socket.on('chickenFightUpdated', (data) => {
        console.log('🐔 Live chicken fight update:', data);
        setLiveData({
          currentFight: data.currentFight || 0,
          fights: data.fights || [],
          bets: data.bets || [],
          entries: data.entries || [],
          bettingStatus: data.bettingStatus || 'open',
          externalTotalBets: data.externalTotalBets || 0,
          externalTotalAmount: data.externalTotalAmount || 0,
          lastUpdate: new Date()
        });
      });

      return () => {
        socket.off('chickenFightUpdated');
      };
    }
  }, []);

  // Set up periodic background updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      updateLiveData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Calculate live betting stats
  const getBettingStats = () => {
    const totalBets = liveData.bets.length;
    const totalAmount = liveData.bets.reduce((sum, bet) => sum + (parseFloat(bet.amount) || 0), 0);
    const meronBets = liveData.bets.filter(bet => bet.side === 'meron');
    const walaBets = liveData.bets.filter(bet => bet.side === 'wala');

    return {
      totalBets,
      totalAmount,
      meronCount: meronBets.length,
      walaCount: walaBets.length,
      meronAmount: meronBets.reduce((sum, bet) => sum + (parseFloat(bet.amount) || 0), 0),
      walaAmount: walaBets.reduce((sum, bet) => sum + (parseFloat(bet.amount) || 0), 0)
    };
  };

  const stats = getBettingStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading live data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold mb-2">Connection Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <FadeInUp>
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">🐔 Live Chicken Fight Dashboard</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>Current Fight: #{liveData.currentFight || 'None'}</span>
              <span>•</span>
              <span>Last Update: {liveData.lastUpdate?.toLocaleTimeString()}</span>
              <span>•</span>
              <span className="font-mono font-bold text-blue-600">{currentTime.toLocaleTimeString()}</span>
              <span>•</span>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                liveData.bettingStatus === 'open' ? 'bg-green-100 text-green-800' :
                liveData.bettingStatus === 'closed' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {liveData.bettingStatus?.toUpperCase() || 'OPEN'}
              </span>
              <button
                onClick={() => {
                  setLoading(true);
                  loadLiveData();
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
              >
                🔄 Refresh
              </button>
              <Pulse>
                <span className="text-green-600 font-semibold">● LIVE</span>
              </Pulse>
            </div>
          </div>
        </FadeInUp>

        {/* Live Stats Overview */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StaggerItem>
            <div className={`p-6 rounded-xl shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} card-hover`}>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-600 mb-2">{stats.totalBets}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Bets</div>
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className={`p-6 rounded-xl shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} card-hover`}>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">{formatCurrency(stats.totalAmount)}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Amount</div>
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className={`p-6 rounded-xl shadow-lg ${isDarkMode ? 'bg-red-50 dark:bg-red-900/20' : 'bg-red-50'} border-l-4 border-red-500`}>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 mb-1">{stats.meronCount}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Meron Bets</div>
                <div className="text-lg font-semibold text-red-600">{formatCurrency(stats.meronAmount)}</div>
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className={`p-6 rounded-xl shadow-lg ${isDarkMode ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-blue-50'} border-l-4 border-blue-500`}>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">{stats.walaCount}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Wala Bets</div>
                <div className="text-lg font-semibold text-blue-600">{formatCurrency(stats.walaAmount)}</div>
              </div>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* External Betting Data */}
        {(liveData.externalTotalBets > 0 || liveData.externalTotalAmount > 0) && (
          <FadeInUp delay={0.15}>
            <div className={`p-6 rounded-xl shadow-lg mb-8 ${isDarkMode ? 'bg-purple-900/20 border-purple-500' : 'bg-purple-50 border-purple-200'} border-l-4`}>
              <h2 className="text-xl font-bold mb-4 text-purple-600">🌐 External Source Data</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">{liveData.externalTotalBets}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">External Bets</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">{formatCurrency(liveData.externalTotalAmount)}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">External Amount</div>
                </div>
              </div>
            </div>
          </FadeInUp>
        )}

        {/* Current Fight Status */}
        <FadeInUp delay={0.2}>
          <div className={`p-6 rounded-xl shadow-lg mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-bold mb-4">🎯 Current Fight Status</h2>
            {liveData.fights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveData.fights.slice(-3).map((fight, index) => (
                  <div key={index} className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">Fight #{fight.fightNumber || 'N/A'}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        fight.status === 'completed' ? 'bg-green-100 text-green-800' :
                        fight.status === 'active' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {fight.status || 'pending'}
                      </span>
                    </div>
                    {fight.meron && fight.wala && (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-red-600">🔴 Meron:</span>
                          <span>{fight.meron.entryName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">🔵 Wala:</span>
                          <span>{fight.wala.entryName}</span>
                        </div>
                        {fight.winner && (
                          <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/20 rounded text-center">
                            <span className="font-bold text-green-600">
                              🏆 Winner: {fight.winner.toUpperCase()} ({fight.meron.entryName})
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No fights scheduled for today</p>
              </div>
            )}
          </div>
        </FadeInUp>

        {/* Live Betting Activity */}
        <FadeInUp delay={0.4}>
          <div className={`p-6 rounded-xl shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-bold mb-4">💰 Live Betting Activity</h2>
            {liveData.bets.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {liveData.bets.slice(-10).reverse().map((bet, index) => (
                  <div key={index} className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} flex justify-between items-center`}>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        bet.side === 'meron' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {bet.side.toUpperCase()}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-medium">{bet.entryName}</span>
                        <span className="text-xs text-gray-500">by {bet.createdByName}</span>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Fight #{bet.gameType}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{formatCurrency(bet.amount)}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(bet.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No betting activity yet</p>
              </div>
            )}
          </div>
        </FadeInUp>

        {/* Active Entries */}
        <FadeInUp delay={0.6}>
          <div className={`p-6 rounded-xl shadow-lg mt-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className="text-xl font-bold mb-4">🐔 Active Entries ({liveData.entries.length})</h2>
            {liveData.entries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveData.entries.map((entry, index) => (
                  <div key={index} className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="font-semibold mb-2">{entry.entryName}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Game Type: <span className="font-medium">{entry.gameType}</span></div>
                      <div>Leg Bands: <span className="font-medium">{entry.legBandNumbers?.join(', ')}</span></div>
                      <div className="text-xs">
                        Created: {new Date(entry.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No entries registered yet</p>
              </div>
            )}
          </div>
        </FadeInUp>
      </div>
    </div>
  );
}