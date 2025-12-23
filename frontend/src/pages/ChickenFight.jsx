import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, Plus, Loader, Check, X } from 'lucide-react';
import { SettingsContext } from '../context/SettingsContext';
import { ChickenFightContext } from '../context/ChickenFightContext';
import { getApiUrl } from '../utils/apiConfig';

export default function ChickenFight() {
  const navigate = useNavigate();
  const { isDarkMode, user } = useContext(SettingsContext);
  const userRole = user?.role || 'admin';
  const { 
    fights, 
    setFights, 
    fightNumber, 
    setFightNumber, 
    today,
    syncing,
    loadTodaysFights,
    recordEntryResults,
    addFight,
    removeFight,
    updateFight,
    entries: contextEntries
  } = useContext(ChickenFightContext);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Game data (includes entryResults)
  const [gameData, setGameData] = useState(null);
  
  // Entries
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  
  // Registrations
  const [registrations, setRegistrations] = useState([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  
  // Registration form
  const [showRegForm, setShowRegForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState('');
  const [selected2Wins, setSelected2Wins] = useState(false);
  const [selected2WinsFee, setSelected2WinsFee] = useState(300); // 300 or 500
  const [global2WinsFee, setGlobal2WinsFee] = useState(300); // Day-based default: Thursday=300, Saturday=500, adjustable
  const [selected3Wins, setSelected3Wins] = useState(false);
  const [submittingReg, setSubmittingReg] = useState(false);
  const [selectedMeronEntry, setSelectedMeronEntry] = useState('');
  const [selectedMeronLegBand, setSelectedMeronLegBand] = useState('');
  const [meronLegBandSearch, setMeronLegBandSearch] = useState('');
  const [meronLegBandEntries, setMeronLegBandEntries] = useState([]); // Multiple entries with same leg band
  const [selectedWalaEntry, setSelectedWalaEntry] = useState('');
  const [selectedWalaLegBand, setSelectedWalaLegBand] = useState('');
  const [walaLegBandSearch, setWalaLegBandSearch] = useState('');
  const [walaLegBandEntries, setWalaLegBandEntries] = useState([]); // Multiple entries with same leg band
  const [showHistory, setShowHistory] = useState(false);
  const [historyDates, setHistoryDates] = useState([]);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null);
  const [historyFights, setHistoryFights] = useState([]);

  // Load fights from context on mount
  useEffect(() => {
    loadTodaysFights();
    loadGameData();
  }, []);
  
  useEffect(() => {
    loadHistoryDates();
  }, []);

  // Load global2WinsFee from localStorage on mount, with day-based default
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 4=Thursday, 6=Saturday
    const defaultFee = dayOfWeek === 4 ? 300 : dayOfWeek === 6 ? 500 : 300; // Thursday=300, Saturday=500, others=300

    const savedFee = localStorage.getItem('chicken-fight-global-2wins-fee');
    if (savedFee) {
      const fee = parseInt(savedFee, 10);
      if (!isNaN(fee)) {
        console.log('Loaded global2WinsFee from localStorage:', fee);
        setGlobal2WinsFee(fee);
      } else {
        console.log(`No valid saved fee, using day-based default: ${defaultFee} (day ${dayOfWeek})`);
        setGlobal2WinsFee(defaultFee);
      }
    } else {
      console.log(`No saved global2WinsFee, using day-based default: ${defaultFee} (day ${dayOfWeek})`);
      setGlobal2WinsFee(defaultFee);
    }
  }, []);

  // Save global2WinsFee to localStorage when it changes
  useEffect(() => {
    console.log('Saving global2WinsFee to localStorage:', global2WinsFee);
    localStorage.setItem('chicken-fight-global-2wins-fee', global2WinsFee.toString());
  }, [global2WinsFee]);

  // Load available history dates
  const loadHistoryDates = () => {
    const dates = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chicken-fight-') && !key.includes('number')) {
        const date = key.replace('chicken-fight-', '');
        if (date !== today && !dates.includes(date)) {
          dates.push(date);
        }
      }
    }
    setHistoryDates(dates.sort().reverse());
  };

  // Load history for selected date
  const loadHistoryForDate = (date) => {
    const savedFights = localStorage.getItem(`chicken-fight-${date}`);
    if (savedFights) {
      setHistoryFights(JSON.parse(savedFights));
      setSelectedHistoryDate(date);
    }
  };

  // Reset today's records
  const handleResetToday = () => {
    if (window.confirm('Are you sure you want to reset today\'s records? This action cannot be undone.')) {
      setFights([]);
      setFightNumber(0);
      setRegistrations([]);
      setSelectedMeronEntry('');
      setSelectedMeronLegBand('');
      setMeronLegBandSearch('');
      setMeronLegBandEntries([]); // Clear multiple entries state
      setSelectedWalaEntry('');
      setSelectedWalaLegBand('');
      setWalaLegBandSearch('');
      setWalaLegBandEntries([]); // Clear multiple entries state
      localStorage.removeItem(`chicken-fight-${today}`);
      localStorage.removeItem(`chicken-fight-number-${today}`);
      setSuccess('Today\'s records have been reset');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  // Get leg bands for selected Meron entry
  const meronEntry = selectedMeronEntry === 'unknown' 
    ? { _id: 'unknown', entryName: 'Unknown Entry', gameType: '2wins', legBandNumbers: [] }
    : entries.find(e => e._id === selectedMeronEntry);
  const meronLegBands = meronEntry?.legBandNumbers || [];

  // Get leg bands for selected Wala entry
  const walaEntry = selectedWalaEntry === 'unknown'
    ? { _id: 'unknown', entryName: 'Unknown Entry', gameType: '2wins', legBandNumbers: [] }
    : entries.find(e => e._id === selectedWalaEntry);
  const walaLegBands = walaEntry?.legBandNumbers || [];

  // Get used fight numbers (leg numbers already used)
  const usedLegNumbers = new Set(fights.map(f => f.legNumber).filter(Boolean));

  // Get all leg bands that have already fought (excluding cancelled fights)
  const usedLegBands = new Set(fights.filter(f => f.result !== 'cancelled').map(f => f.legBandFought).filter(Boolean));

  // Filter out already-used leg bands
  const availableMeronLegBands = meronLegBands.filter(band => !usedLegBands.has(band));
  const availableWalaLegBands = walaLegBands.filter(band => !usedLegBands.has(band));

  // Get all entries (including those without leg bands - "unknown" entries)
  const availableEntries = entries.filter(entry => {
    // Include all entries, but we'll handle leg band logic separately
    return true;
  });

  // Filter Meron entries - exclude if already selected in Wala, and exclude entries with no available leg bands
  const availableMeronEntries = availableEntries.filter(entry => {
    // Exclude if already selected in Wala
    if (entry._id === selectedWalaEntry) return false;
    
    // Exclude if entry has no leg bands available (all used in fights)
    if (entry.legBandNumbers && entry.legBandNumbers.length > 0) {
      const availableBands = entry.legBandNumbers.filter(band => !usedLegBands.has(band));
      return availableBands.length > 0;
    }
    
    // Include entries with no leg bands (unknown entries)
    return true;
  });

  // Filter Wala entries - exclude if already selected in Meron, and exclude entries with no available leg bands
  const availableWalaEntries = availableEntries.filter(entry => {
    // Exclude if already selected in Meron
    if (entry._id === selectedMeronEntry) return false;
    
    // Exclude if entry has no leg bands available (all used in fights)
    if (entry.legBandNumbers && entry.legBandNumbers.length > 0) {
      const availableBands = entry.legBandNumbers.filter(band => !usedLegBands.has(band));
      return availableBands.length > 0;
    }
    
    // Include entries with no leg bands (unknown entries)
    return true;
  });

  // Handle Meron leg band search - auto-select entry and leg band or show multiple options
  const handleMeronLegBandSearch = (value) => {
    setMeronLegBandSearch(value);
    if (!value.trim()) {
      setSelectedMeronEntry('');
      setSelectedMeronLegBand('');
      setMeronLegBandEntries([]);
      return;
    }
    
    const trimmedValue = value.trim();
    
    // Special case: "000" for unknown entries
    if (trimmedValue === '000') {
      // Allow unknown entry selection
      setSelectedMeronEntry('unknown');
      setSelectedMeronLegBand('unknown');
      setMeronLegBandEntries([]);
      return;
    }
    
    // Search for all entries with this leg band that is available (not used)
    const foundEntries = availableMeronEntries.filter(entry => 
      entry.legBandNumbers?.includes(trimmedValue) && !usedLegBands.has(trimmedValue)
    );
    
    if (foundEntries.length === 1) {
      // Only one entry found, auto-select it
      setSelectedMeronEntry(foundEntries[0]._id);
      setSelectedMeronLegBand(trimmedValue);
      setMeronLegBandEntries([]);
    } else if (foundEntries.length > 1) {
      // Multiple entries found, show selection dropdown
      setMeronLegBandEntries(foundEntries);
      setSelectedMeronEntry('');
      setSelectedMeronLegBand(trimmedValue);
    } else {
      // No entry found with this leg band, clear selection
      setSelectedMeronEntry('');
      setSelectedMeronLegBand('');
      setMeronLegBandEntries([]);
    }
  };

  // Handle Wala leg band search - auto-select entry and leg band or show multiple options
  const handleWalaLegBandSearch = (value) => {
    setWalaLegBandSearch(value);
    if (!value.trim()) {
      setSelectedWalaEntry('');
      setSelectedWalaLegBand('');
      setWalaLegBandEntries([]);
      return;
    }
    
    const trimmedValue = value.trim();
    
    // Special case: "000" for unknown entries
    if (trimmedValue === '000') {
      // Allow unknown entry selection
      setSelectedWalaEntry('unknown');
      setSelectedWalaLegBand('unknown');
      setWalaLegBandEntries([]);
      return;
    }
    
    // Search for all entries with this leg band that is available (not used)
    const foundEntries = availableWalaEntries.filter(entry => 
      entry.legBandNumbers?.includes(trimmedValue) && !usedLegBands.has(trimmedValue)
    );
    
    if (foundEntries.length === 1) {
      // Only one entry found, auto-select it
      setSelectedWalaEntry(foundEntries[0]._id);
      setSelectedWalaLegBand(trimmedValue);
      setWalaLegBandEntries([]);
    } else if (foundEntries.length > 1) {
      // Multiple entries found, show selection dropdown
      setWalaLegBandEntries(foundEntries);
      setSelectedWalaEntry('');
      setSelectedWalaLegBand(trimmedValue);
    } else {
      // No entry found with this leg band, clear selection
      setSelectedWalaEntry('');
      setSelectedWalaLegBand('');
      setWalaLegBandEntries([]);
    }
  };

  const handleMeronWin = async () => {
    // Allow fights where at least one entry has a leg band (the other can be "unknown")
    const hasMeronLegBand = selectedMeronEntry && selectedMeronLegBand;
    const hasWalaLegBand = selectedWalaEntry && selectedWalaLegBand;
    
    if (!selectedMeronEntry || !selectedWalaEntry || (!hasMeronLegBand && !hasWalaLegBand)) {
      setError('Please select both Meron and Wala entries, with at least one having a leg band');
      return;
    }
    
    // Check if leg bands have already been used (only for entries that have leg bands)
    if (hasMeronLegBand && usedLegBands.has(selectedMeronLegBand)) {
      setError(`Leg band ${selectedMeronLegBand} (Meron) has already fought`);
      return;
    }
    if (hasWalaLegBand && usedLegBands.has(selectedWalaLegBand)) {
      setError(`Leg band ${selectedWalaLegBand} (Wala) has already fought`);
      return;
    }
    
    const meronFight = {
      id: fightNumber + 1,
      entryName: meronEntry.entryName,
      legBand: hasMeronLegBand ? selectedMeronLegBand : 'unknown',
      legBandFought: hasMeronLegBand ? selectedMeronLegBand : 'unknown',
      result: 1  // 1 for win
    };
    const walaFight = {
      id: fightNumber + 1,
      entryName: walaEntry.entryName,
      legBand: hasWalaLegBand ? selectedWalaLegBand : 'unknown',
      legBandFought: hasWalaLegBand ? selectedWalaLegBand : 'unknown',
      result: 0  // 0 for loss
    };
    
    // Build entry results for backend
    // Build entry results for backend (only for real entries, not unknown)
    const entryResults = [];
    
    if (meronEntry._id !== 'unknown') {
      entryResults.push({
        entryId: meronEntry._id,
        entryName: meronEntry.entryName,
        gameType: meronEntry.gameType,
        legResults: [
          { legNumber: fightNumber + 1, result: 'win' }
        ]
      });
    }
    
    if (walaEntry._id !== 'unknown') {
      entryResults.push({
        entryId: walaEntry._id,
        entryName: walaEntry.entryName,
        gameType: walaEntry.gameType,
        legResults: [
          { legNumber: fightNumber + 1, result: 'loss' }
        ]
      });
    }
    
    // Update local state
    const newFights = [...fights, meronFight, walaFight];
    setFights(newFights);
    setFightNumber(fightNumber + 1);
    
    // Record results to backend (only if there are known entries)
    let recordSuccess = true;
    if (entryResults.length > 0) {
      recordSuccess = await recordEntryResults(entryResults);
    }
    
    if (!recordSuccess) {
      setError('Failed to record results to server. Please try again.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setSuccess(`Meron (${meronEntry.entryName}) defeats Wala (${walaEntry.entryName})`);
    setSelectedMeronEntry('');
    setSelectedMeronLegBand('');
    setMeronLegBandSearch('');
    setMeronLegBandEntries([]); // Clear multiple entries state
    setSelectedWalaEntry('');
    setSelectedWalaLegBand('');
    setWalaLegBandSearch('');
    setWalaLegBandEntries([]); // Clear multiple entries state
    setTimeout(() => setSuccess(''), 2000);
    
    // Reload game data to sync
    await loadGameData();
  };

  const handleWalaWin = async () => {
    // Allow fights where at least one entry has a leg band (the other can be "unknown")
    const hasMeronLegBand = selectedMeronEntry && selectedMeronLegBand;
    const hasWalaLegBand = selectedWalaEntry && selectedWalaLegBand;
    
    if (!selectedMeronEntry || !selectedWalaEntry || (!hasMeronLegBand && !hasWalaLegBand)) {
      setError('Please select both Meron and Wala entries, with at least one having a leg band');
      return;
    }
    
    // Check if leg bands have already been used (only for entries that have leg bands)
    if (hasMeronLegBand && usedLegBands.has(selectedMeronLegBand)) {
      setError(`Leg band ${selectedMeronLegBand} (Meron) has already fought`);
      return;
    }
    if (hasWalaLegBand && usedLegBands.has(selectedWalaLegBand)) {
      setError(`Leg band ${selectedWalaLegBand} (Wala) has already fought`);
      return;
    }
    
    const meronFight = {
      id: fightNumber + 1,
      entryName: meronEntry.entryName,
      legBand: hasMeronLegBand ? selectedMeronLegBand : 'unknown',
      legBandFought: hasMeronLegBand ? selectedMeronLegBand : 'unknown',
      result: 0  // 0 for loss
    };
    const walaFight = {
      id: fightNumber + 1,
      entryName: walaEntry.entryName,
      legBand: hasWalaLegBand ? selectedWalaLegBand : 'unknown',
      legBandFought: hasWalaLegBand ? selectedWalaLegBand : 'unknown',
      result: 1  // 1 for win
    };
    
    // Build entry results for backend (only for real entries, not unknown)
    const entryResults = [];
    
    if (meronEntry._id !== 'unknown') {
      entryResults.push({
        entryId: meronEntry._id,
        entryName: meronEntry.entryName,
        gameType: meronEntry.gameType,
        legResults: [
          { legNumber: fightNumber + 1, result: 'loss' }
        ]
      });
    }
    
    if (walaEntry._id !== 'unknown') {
      entryResults.push({
        entryId: walaEntry._id,
        entryName: walaEntry.entryName,
        gameType: walaEntry.gameType,
        legResults: [
          { legNumber: fightNumber + 1, result: 'win' }
        ]
      });
    }
    
    // Update local state
    const newFights = [...fights, meronFight, walaFight];
    setFights(newFights);
    setFightNumber(fightNumber + 1);
    
    // Record results to backend (only if there are known entries)
    let recordSuccess = true;
    if (entryResults.length > 0) {
      recordSuccess = await recordEntryResults(entryResults);
    }
    
    if (!recordSuccess) {
      setError('Failed to record results to server. Please try again.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setSuccess(`Wala (${walaEntry.entryName}) defeats Meron (${meronEntry.entryName})`);
    setSelectedMeronEntry('');
    setSelectedMeronLegBand('');
    setMeronLegBandSearch('');
    setMeronLegBandEntries([]); // Clear multiple entries state
    setSelectedWalaEntry('');
    setSelectedWalaLegBand('');
    setWalaLegBandSearch('');
    setWalaLegBandEntries([]); // Clear multiple entries state
    setTimeout(() => setSuccess(''), 2000);
    
    // Reload game data to sync
    await loadGameData();
  };
  
  // Stats
  const [stats, setStats] = useState(null);

  // Fetch data on load
  useEffect(() => {
    const initialize = async () => {
      // Fetch sequentially with small delays to avoid rate limiting
      await fetchEntries();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await fetchRegistrations();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await fetchStats();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Auto-register all entries that don't have registrations
      await autoRegisterEntries();
    };
    initialize();
  }, []);

  // Load full game data including entry results
  const loadGameData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${getApiUrl()}/api/chicken-fight/fights/today`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success && response.data.game) {
        setGameData(response.data.game);
        console.log('✅ Game data loaded:', response.data.game);
        
        // Sync fights array from gameData.entryResults
        if (response.data.game.entryResults && response.data.game.entryResults.length > 0) {
          const syncedFights = [];
          const legNumbers = response.data.game.entryResults.flatMap(e => 
            e.legResults?.map(l => l.legNumber) || []
          );
          const maxLegNumber = legNumbers.length > 0 ? Math.max(...legNumbers) : 0;
          
          console.log('📊 Leg numbers found:', legNumbers, 'Max:', maxLegNumber);
          
          // Populate fights array from entry results
          response.data.game.entryResults.forEach(entry => {
            entry.legResults?.forEach(leg => {
              const resultValue = leg.result === 'win' ? 1 : leg.result === 'draw' ? 0.5 : leg.result === 'cancelled' ? -1 : 0;
              syncedFights.push({
                legNumber: leg.legNumber,
                entryId: entry.entryId,
                entryName: entry.entryName,
                gameType: entry.gameType,
                result: resultValue
              });
            });
          });
          
          console.log('🔄 Syncing fights from gameData:', syncedFights);
          setFights(syncedFights);
          const newFightNumber = Number.isFinite(maxLegNumber) ? maxLegNumber : 0;
          console.log('📝 Setting fight number to:', newFightNumber);
          setFightNumber(newFightNumber);
        }
      }
    } catch (err) {
      console.error('Error loading game data:', err);
    }
  };

  // Fetch available entries
  const fetchEntries = async () => {
    setEntriesLoading(true);
    try {
      const response = await axios.get(`${getApiUrl()}/api/chicken-fight/entries`);
      if (response.data.success) {
        setEntries(response.data.entries || []);
      }
    } catch (err) {
      console.error('Error fetching entries:', err);
      setError('Failed to load entries');
    } finally {
      setEntriesLoading(false);
    }
  };

  // Fetch registrations for today
  const fetchRegistrations = async () => {
    setRegistrationsLoading(true);
    try {
      console.log(`📝 Fetching registrations for date: ${today}`);
      const response = await axios.get(`${getApiUrl()}/api/chicken-fight-registration/registrations`, {
        params: { gameDate: today },
        timeout: 10000
      });
      console.log(`✅ Registrations response:`, response.data);
      if (response.data.success) {
        setRegistrations(response.data.registrations || []);
        console.log(`📊 Loaded ${response.data.count} registrations`);
      } else {
        console.warn('⚠️ API returned success: false');
        setRegistrations([]);
      }
    } catch (err) {
      // Suppress 429 rate limit errors from console
      if (err.response?.status !== 429) {
        console.error('❌ Error fetching registrations:', err.message);
        console.error('  Status:', err.response?.status);
      }
      setRegistrations([]);
    } finally {
      setRegistrationsLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${getApiUrl()}/api/chicken-fight-registration/registrations-stats`, {
        params: { gameDate: today },
        timeout: 10000
      });
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (err) {
      // Suppress 429 rate limit errors from console
      if (err.response?.status !== 429) {
        console.error('Error fetching stats:', err.message);
      }
    }
  };

  // Register entry
  const handleRegisterEntry = async () => {
    if (!selectedEntry || (!selected2Wins && !selected3Wins)) {
      setError('Please select an entry and at least one game type');
      return;
    }

    const entry = entries.find(e => e._id === selectedEntry) || 
      (selectedEntry === 'unknown' ? { _id: 'unknown', entryName: 'Unknown', gameType: selected2Wins ? '2wins' : '3wins' } : null);
    
    if (!entry) {
      setError('Selected entry not found');
      return;
    }
    const gameTypes = [];
    const registrations = [];
    
    if (selected2Wins) {
      gameTypes.push('2wins');
      registrations.push({
        gameType: '2wins',
        registrationFee: global2WinsFee
      });
      console.log('Adding 2wins registration with fee:', global2WinsFee);
    }
    if (selected3Wins) {
      gameTypes.push('3wins');
      registrations.push({
        gameType: '3wins',
        registrationFee: 1000
      });
    }

    setSubmittingReg(true);
    try {
      console.log('Sending registration request:', {
        entryId: selectedEntry,
        entryName: entry.entryName,
        gameTypes,
        registrations,
        gameDate: today
      });
      await axios.post(`${getApiUrl()}/api/chicken-fight-registration/registrations`, {
        entryId: selectedEntry,
        entryName: entry.entryName,
        gameTypes,
        registrations,
        gameDate: today
      });

      setSuccess(`Entry "${entry.entryName}" registered successfully!`);
      setSelectedEntry('');
      setSelected2Wins(false);
      setSelected2WinsFee(500);
      setSelected3Wins(false);
      setShowRegForm(false);
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Registration error:', err.response?.data, err.response?.status, err.message);
      setError(err.response?.data?.message || `Failed to register entry (${err.response?.status})`);
    } finally {
      setSubmittingReg(false);
    }
  };

  // Mark as paid
  const handleMarkPaid = async (registrationId, gameType) => {
    try {
      await axios.put(
        `${getApiUrl()}/api/chicken-fight-registration/registrations/${registrationId}/pay`,
        { gameType }
      );

      setSuccess(`Payment recorded for ${gameType}`);
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark payment');
    }
  };

  // Mark all entries as paid
  const handleMarkAllPaid = async () => {
    if (!window.confirm('Mark ALL unpaid registrations as paid?')) return;

    setSubmittingReg(true);
    try {
      const unpaidRegs = registrations.filter(reg =>
        reg.registrations.some(r => !r.isPaid)
      );

      let successCount = 0;
      for (const reg of unpaidRegs) {
        for (const gameReg of reg.registrations) {
          if (!gameReg.isPaid) {
            try {
              await axios.put(
                `${getApiUrl()}/api/chicken-fight-registration/registrations/${reg._id}/pay`,
                { gameType: gameReg.gameType }
              );
              successCount++;
            } catch (err) {
              console.error(`Failed to mark ${reg.entryName} - ${gameReg.gameType} as paid`);
            }
          }
        }
      }

      setSuccess(`Marked ${successCount} payments as paid!`);
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to mark all payments');
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleWithdrawAllPaid = async () => {
    if (!window.confirm('Withdraw ALL paid registrations?')) return;

    setSubmittingReg(true);
    try {
      const paidRegs = registrations.filter(reg =>
        reg.registrations.some(r => r.isPaid)
      );

      let successCount = 0;
      for (const reg of paidRegs) {
        for (const gameReg of reg.registrations) {
          if (gameReg.isPaid) {
            try {
              await axios.put(
                `${getApiUrl()}/api/chicken-fight-registration/registrations/${reg._id}/withdraw`,
                { gameType: gameReg.gameType }
              );
              successCount++;
            } catch (err) {
              console.error(`Failed to withdraw ${reg.entryName} - ${gameReg.gameType} payment`);
            }
          }
        }
      }

      setSuccess(`Withdrew ${successCount} payments!`);
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to withdraw all payments');
    } finally {
      setSubmittingReg(false);
    }
  };

  // Delete registration
  const handleDeleteRegistration = async (registrationId) => {
    if (!window.confirm('Delete this registration?')) return;

    try {
      await axios.delete(
        `${getApiUrl()}/api/chicken-fight-registration/registrations/${registrationId}`
      );

      setSuccess('Registration deleted');
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete registration');
    }
  };

  // Auto-register all entries on page load (with debounce and delays)
  const autoRegisterEntries = async () => {
    try {
      const response = await axios.get(`${getApiUrl()}/api/chicken-fight/entries`, {
        timeout: 10000
      });
      
      if (response.data.success && response.data.entries) {
        console.log(`🔄 Auto-registering ${response.data.entries.length} entries...`);
        
        // Register entries sequentially with delay to avoid rate limiting
        const DELAY_MS = 200; // 200ms delay between requests
        
        for (let i = 0; i < response.data.entries.length; i++) {
          const entry = response.data.entries[i];
          
          try {
            await axios.post(`${getApiUrl()}/api/chicken-fight-registration/registrations`, {
              entryId: entry._id,
              entryName: entry.entryName,
              gameTypes: ['2wins', '3wins'],
              gameDate: today
            }, {
              timeout: 10000
            }).then(() => {
              console.log(`✅ Registered: ${entry.entryName}`);
            }).catch((err) => {
              // Silently ignore if already registered (409 conflict) or other errors
              if (err.response?.status !== 409) {
                console.warn(`⚠️ Registration skipped for ${entry.entryName}:`, err.response?.status);
              }
            });
            
            // Add delay between requests to avoid rate limiting
            if (i < response.data.entries.length - 1) {
              await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
          } catch (err) {
            console.error(`❌ Error registering ${entry.entryName}:`, err.message);
          }
        }
        
        console.log('✅ Auto-registration complete, fetching updated data...');
        await fetchRegistrations();
        await fetchStats();
      }
    } catch (err) {
      // Suppress console spam for 429 errors - they're rate limit related
      if (err.response?.status !== 429) {
        console.error('Auto-registration error:', err.message);
      }
    }
  };

  // Withdraw payment (mark as unpaid)
  const handleWithdrawPayment = async (registrationId, gameType) => {
    try {
      await axios.put(
        `${getApiUrl()}/api/chicken-fight-registration/registrations/${registrationId}/withdraw`,
        { gameType }
      );

      setSuccess(`Payment withdrawn for ${gameType}`);
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to withdraw payment');
    }
  };

  // Insurance payment
  const handleInsurance = async (registrationId) => {
    try {
      await axios.put(
        `${getApiUrl()}/api/chicken-fight-registration/registrations/${registrationId}/insurance`,
        {}
      );

      setSuccess('Insurance recorded');
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record insurance');
    }
  };

  // Toggle valid champion status
  const toggleValidChampion = async (registrationId, currentStatus) => {
    const newStatus = !currentStatus;
    const action = newStatus ? 'valid' : 'invalid';
    
    if (!window.confirm(`Mark this entry as ${action} champion?`)) return;

    try {
      await axios.put(
        `${getApiUrl()}/api/chicken-fight-registration/registrations/${registrationId}/valid-champion`,
        { isValidChampion: newStatus }
      );

      setSuccess(`Entry marked as ${action} champion`);
      fetchRegistrations();
      fetchStats();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to mark as ${action} champion`);
    }
  };

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Left Sidebar - RESULT */}
      <div className={`w-48 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-900'} text-white p-4 overflow-y-auto`}>
        <div className="mb-6">
          <button 
            onClick={() => navigate(`/${userRole}/chicken-fight-results`)}
            className="w-full font-bold text-white bg-gray-700 hover:bg-gray-600 p-3 rounded mb-2 text-center transition duration-200 cursor-pointer"
            title="Click to edit/delete fight results"
          >
            RESULT
          </button>
          
          {/* Fight Number Display */}
          <div className={`text-center p-3 rounded mb-4 font-bold ${isDarkMode ? 'bg-gray-700 text-yellow-300' : 'bg-gray-200 text-yellow-700'}`}>
            <div className="text-xs opacity-75">FIGHT #</div>
            <div className="text-2xl">{Number.isFinite(fightNumber) ? fightNumber : 0}</div>
          </div>
          
          {/* Score Summary with Champions */}
          <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-400'} mb-4 space-y-2`}>
            {(() => {
              // Count wins per entry (only count result === 1)
              const entryWins = {};
              fights.forEach(fight => {
                if (fight.result === 1) {
                  entryWins[fight.entryName] = (entryWins[fight.entryName] || 0) + 1;
                }
              });

              // Find champions (2 wins for 2wins entries, 3 wins for 3wins entries)
              const meronChampions = Object.entries(entryWins)
                .filter(([name, wins]) => {
                  const fight = fights.find(f => f.entryName === name);
                  const registration = registrations.find(r => r.entryName === name);
                  return fight?.gameType === '2wins' && wins >= 2 && registration?.isValidChampion !== false;
                })
                .map(([name]) => name);

              const walaChampions = Object.entries(entryWins)
                .filter(([name, wins]) => {
                  const fight = fights.find(f => f.entryName === name);
                  const registration = registrations.find(r => r.entryName === name);
                  return fight?.gameType === '3wins' && wins >= 3 && registration?.isValidChampion !== false;
                })
                .map(([name]) => name);

                const meronScore = fights.filter(f => f.gameType === '2wins' && f.result === 1).length;
              const walaScore = fights.filter(f => f.gameType === '3wins' && f.result === 1).length;

              // Get all Meron fights (2wins) with their results
              const meronFights = fights.filter(f => f.gameType === '2wins');

              // Get all Wala fights (3wins) with their results
              const walaFights = fights.filter(f => f.gameType === '3wins');

              return (
                <>
                  <div className="bg-red-700 p-3 rounded font-medium">
                    <div className="flex justify-between items-center mb-2">
                      <span>MERON</span>
                      <span>{meronScore}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {meronFights.map((fight, idx) => (
                        <span key={idx} className="font-bold text-sm">{fight.result}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-blue-700 p-3 rounded font-medium">
                    <div className="flex justify-between items-center mb-2">
                      <span>WALA</span>
                      <span>{walaScore}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {walaFights.map((fight, idx) => (
                        <span key={idx} className="font-bold text-sm">{fight.result}</span>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Fight List with Champions and Win/Loss Indicators */}
        <div className="text-xs space-y-1">
          {fights.length === 0 ? (
            <div className={`p-2 text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
              No fights recorded
            </div>
          ) : (
            (() => {
              // Track entry types and their fight results
              let entryTypes = {}; // Track entry types
              fights.forEach(fight => {
                const entry = entries.find(e => e.entryName === fight.entryName);
                if (entry) {
                  entryTypes[fight.entryName] = entry.gameType;
                }
              });

              // Get unique entries in order of first appearance
              const uniqueEntries = [];
              const seenEntries = new Set();
              fights.forEach(fight => {
                if (!seenEntries.has(fight.entryName)) {
                  seenEntries.add(fight.entryName);
                  uniqueEntries.push({
                    name: fight.entryName,
                    gameType: entryTypes[fight.entryName]
                  });
                }
              });

              return uniqueEntries.map(entryData => {
                const entry = entries.find(e => e.entryName === entryData.name);
                const registration = registrations.find(r => r.entryName === entryData.name);
                // Get all fight results for this entry (1 for win, 0 for loss)
                const entryFights = fights.filter(f => f.entryName === entryData.name);
                const wins = entryFights.filter(f => f.result === 1).length;
                const isMeronChampion = entry?.gameType === '2wins' && wins >= 2 && registration?.isValidChampion !== false;
                const isWalaChampion = entry?.gameType === '3wins' && wins >= 3 && registration?.isValidChampion !== false;
                const isChampion = isMeronChampion || isWalaChampion;

                return (
                  <div key={entryData.name} className={`p-2 rounded font-medium flex items-center justify-between gap-2 ${
                    entry?.gameType === '2wins' ? 'bg-red-700' : 'bg-blue-700'
                  }`}>
                    <div className="flex items-center gap-1 truncate flex-1">
                      {isChampion && <span>★</span>}
                      <span className="truncate">{entryData.name}</span>
                    </div>
                    {/* Win/Loss/Draw Indicators - Show actual results (1 for win, 0 for loss, 0.5 for draw) */}
                    <div className="flex gap-1 items-center flex-shrink-0">
                      {entryFights.map((fight, idx) => (
                        <span
                          key={idx}
                          className={`font-bold text-sm ${
                            fight.result === 1 ? 'text-white' : 
                            fight.result === 0.5 ? 'text-yellow-200' : 
                            fight.result === 'cancelled' ? 'text-gray-400' : 
                            'text-red-200'
                          }`}
                        >
                          {fight.result === 0.5 ? '1/2' : fight.result === 'cancelled' ? 'X' : fight.result}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 p-8 overflow-y-auto ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            RMI {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
            >
              {showHistory ? 'Hide History' : 'View History'}
            </button>
            <button
              onClick={handleResetToday}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
            >
              Reset Today
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center gap-3">
            <AlertCircle size={20} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')}>
              <X size={18} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded flex items-center gap-3">
            <Check size={20} />
            <span>{success}</span>
          </div>
        )}

        {/* History Viewer */}
        {showHistory && (
          <div className={`mb-6 rounded-xl border shadow-lg ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className={`flex justify-between items-center p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>📅 Fight History</h2>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>Review past records and fights</p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className={`p-2 rounded-lg transition ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {historyDates.length === 0 ? (
                <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <p className="text-lg">No history records found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Date List */}
                  <div className={`lg:col-span-1 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg p-4 max-h-96 overflow-y-auto`}>
                    <h3 className={`font-bold mb-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>AVAILABLE DATES</h3>
                    <div className="space-y-2">
                      {historyDates.map(date => (
                        <button
                          key={date}
                          onClick={() => loadHistoryForDate(date)}
                          className={`w-full text-left px-4 py-3 rounded-lg transition font-medium text-sm ${
                            selectedHistoryDate === date
                              ? isDarkMode 
                                ? 'bg-blue-600 text-white shadow-lg' 
                                : 'bg-blue-500 text-white shadow-lg'
                              : isDarkMode 
                                ? 'bg-gray-600 hover:bg-gray-500 text-gray-100' 
                                : 'bg-white hover:bg-gray-100 text-gray-900 border border-gray-200'
                          }`}
                        >
                          {new Date(date).toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric' 
                          })}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fight Records */}
                  <div className="lg:col-span-2">
                    <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <h3 className={`font-bold mb-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {selectedHistoryDate 
                          ? `FIGHTS - ${new Date(selectedHistoryDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
                          : 'SELECT A DATE TO VIEW FIGHTS'
                        }
                      </h3>
                      <div className={`max-h-96 overflow-y-auto space-y-2`}>
                        {selectedHistoryDate && historyFights.length > 0 ? (
                          <div className="space-y-2">
                            {(() => {
                              // Group fights by entry name
                              const groupedByEntry = {};
                              historyFights.forEach(fight => {
                                if (!groupedByEntry[fight.entryName]) {
                                  groupedByEntry[fight.entryName] = [];
                                }
                                groupedByEntry[fight.entryName].push(fight);
                              });
                              
                              // Display each entry with all its fight results
                              return Object.entries(groupedByEntry).map(([entryName, fights]) => {
                                const entry = entries.find(e => e.entryName === entryName);
                                const wins = fights.filter(f => f.result === 1).length;
                                const losses = fights.filter(f => f.result === 0).length;
                                
                                return (
                                  <div 
                                    key={entryName} 
                                    className={`p-4 rounded-lg border-l-4 ${
                                      entry?.gameType === '2wins'
                                        ? isDarkMode ? 'bg-red-900/30 border-red-600 text-red-200' : 'bg-red-50 border-red-400 text-red-900'
                                        : isDarkMode ? 'bg-blue-900/30 border-blue-600 text-blue-200' : 'bg-blue-50 border-blue-400 text-blue-900'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start gap-3 mb-3">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : ''}`}>{entryName}</span>
                                          {entry && (
                                            <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                                              entry.gameType === '2wins'
                                                ? isDarkMode ? 'bg-red-900/50 text-red-200' : 'bg-red-200 text-red-800'
                                                : isDarkMode ? 'bg-blue-900/50 text-blue-200' : 'bg-blue-200 text-blue-800'
                                            }`}>
                                              {entry.gameType === '2wins' ? '2-WINS' : '3-WINS'}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs">Record: <span className="font-bold">{wins}W - {losses}L</span></div>
                                      </div>
                                      <div className="flex gap-1">
                                        {fights.map((fight, idx) => (
                                          <span 
                                            key={idx} 
                                            className={`px-2 py-1 rounded text-xs font-bold ${
                                              fight.result === 1 
                                                ? isDarkMode ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                                                : isDarkMode ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
                                            }`}
                                          >
                                            {fight.result === 1 ? 'W' : 'L'}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="text-xs space-y-1">
                                      {fights.map((fight, idx) => (
                                        <div key={idx} className="flex gap-2">
                                          <span>Fight {idx + 1}:</span>
                                          <span className="font-mono">{fight.legBand}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        ) : selectedHistoryDate ? (
                          <p className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>No fights recorded on this date</p>
                        ) : (
                          <p className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Select a date to view fight records</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Three Column Display - Meron, Fight Number, Wala */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Meron Column */}
          <div className="bg-red-700 text-white rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">MERON</h2>
            
            {/* Leg Band Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Search Leg Band</label>
              <input
                type="text"
                value={meronLegBandSearch}
                onChange={(e) => handleMeronLegBandSearch(e.target.value)}
                placeholder="Enter leg band number or '000' for unknown..."
                className="w-full px-4 py-2 rounded-lg bg-red-600 text-white border border-red-500 placeholder-red-300"
              />
              
              {/* Entry selection for multiple entries with same leg band */}
              {meronLegBandEntries.length > 1 && (
                <div className="mt-2">
                  <label className="block text-xs font-medium mb-1">Multiple entries found - select one:</label>
                  <select
                    value={selectedMeronEntry}
                    onChange={(e) => {
                      setSelectedMeronEntry(e.target.value);
                      setMeronLegBandEntries([]); // Clear multiple entries after selection
                    }}
                    className="w-full px-3 py-1 rounded bg-red-600 text-white border border-red-500 text-sm"
                  >
                    <option value="">Choose entry...</option>
                    {meronLegBandEntries.map(entry => (
                      <option key={entry._id} value={entry._id}>
                        {entry.entryName} ({entry.gameType})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {meronLegBandSearch && selectedMeronEntry && meronLegBandEntries.length <= 1 && (
                <div className="mt-2 p-2 bg-red-600 rounded text-sm">
                  <div className="font-medium">{meronEntry?.entryName}</div>
                  <div className="text-xs">
                    Leg Band: {meronLegBandSearch === '000' ? 'Unknown (000)' : selectedMeronLegBand}
                  </div>
                </div>
              )}
            </div>
            
            {/* Entry Selection Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Or Select Entry</label>
              <select
                value={selectedMeronEntry}
                onChange={(e) => {
                  setSelectedMeronEntry(e.target.value);
                  setSelectedMeronLegBand(''); // Clear leg band when manually selecting entry
                  setMeronLegBandSearch('');
                  setMeronLegBandEntries([]); // Clear multiple entries state
                  if (e.target.value) {
                    const entry = entries.find(ent => ent._id === e.target.value);
                    if (entry && entry.legBandNumbers && entry.legBandNumbers.length > 0) {
                      // If entry has leg bands, auto-select the first available one
                      const availableBands = entry.legBandNumbers.filter(band => !usedLegBands.has(band));
                      if (availableBands.length > 0) {
                        setSelectedMeronLegBand(availableBands[0]);
                      }
                    }
                  }
                }}
                className="w-full px-4 py-2 rounded-lg bg-red-600 text-white border border-red-500"
              >
                <option value="">Choose an entry...</option>
                {availableMeronEntries.map(entry => (
                  <option key={entry._id} value={entry._id}>
                    {entry.entryName} ({entry.legBandNumbers && entry.legBandNumbers.length > 0 ? `${entry.legBandNumbers.length} leg band(s)` : 'Unknown'})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Show selected entry score */}
            {selectedMeronEntry && meronEntry && (
              <div className="mb-4 p-3 bg-red-600 rounded text-sm">
                <div className="font-medium mb-2">Entry Score</div>
                <div className="space-y-2">
                  <div className="text-sm font-bold">{meronEntry.entryName}</div>
                  <div className="text-xs text-red-100">Type: {meronEntry.gameType}</div>
                  <div className="border-t border-red-500 pt-2 mt-2">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs">Total Fights:</span>
                      <span className="text-sm font-bold">{fights.filter(f => f.entryName === meronEntry.entryName).length}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs">Wins:</span>
                      <span className="text-lg font-bold text-yellow-300">{fights.filter(f => f.entryName === meronEntry.entryName && f.result === 1).length}</span>
                    </div>
                    {/* Fight Sequence */}
                    <div className="text-center">
                      <div className="text-xs text-red-200 mb-1">Sequence:</div>
                      <div className="text-2xl font-bold tracking-wider">
                        {fights.filter(f => f.entryName === meronEntry.entryName)
                          .map(f => f.result === 1 ? '1' : f.result === 0.5 ? '½' : '0')
                          .join('') || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Win Button */}
            <button
              onClick={handleMeronWin}
              disabled={!selectedMeronEntry || !selectedWalaEntry || (selectedMeronLegBand && usedLegBands.has(selectedMeronLegBand)) || (selectedWalaLegBand && usedLegBands.has(selectedWalaLegBand))}
              className={`w-full py-3 font-bold rounded-lg text-lg transition ${
                selectedMeronEntry && selectedWalaEntry && (!selectedMeronLegBand || !usedLegBands.has(selectedMeronLegBand)) && (!selectedWalaLegBand || !usedLegBands.has(selectedWalaLegBand))
                  ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                  : 'bg-red-900 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              MERON WINS
            </button>
          </div>

          {/* Fight Number Column */}
          <div className="bg-gray-800 text-white rounded-lg p-8 flex flex-col items-center justify-center">
            <div className="text-7xl font-bold mb-4">{Number.isFinite(fightNumber) ? fightNumber : 0}</div>
            <div className="text-lg font-bold mb-6">FIGHT</div>
            <button
              onClick={async () => {
                if (selectedMeronEntry && selectedMeronLegBand && selectedWalaEntry && selectedWalaLegBand) {
                  // Check if either leg band has already been used
                  if (usedLegBands.has(selectedMeronLegBand)) {
                    setError(`Leg band ${selectedMeronLegBand} (Meron) has already fought`);
                    return;
                  }
                  if (usedLegBands.has(selectedWalaLegBand)) {
                    setError(`Leg band ${selectedWalaLegBand} (Wala) has already fought`);
                    return;
                  }
                  
                  // Build entry results for draw (both entries get 0.5)
                  // Skip recording for unknown entries
                  const entryResults = [];
                  
                  if (meronEntry._id !== 'unknown') {
                    entryResults.push({
                      entryId: meronEntry._id,
                      entryName: meronEntry.entryName,
                      gameType: meronEntry.gameType,
                      legResults: [
                        { legNumber: fightNumber + 1, result: 'draw' }
                      ]
                    });
                  }
                  
                  if (walaEntry._id !== 'unknown') {
                    entryResults.push({
                      entryId: walaEntry._id,
                      entryName: walaEntry.entryName,
                      gameType: walaEntry.gameType,
                      legResults: [
                        { legNumber: fightNumber + 1, result: 'draw' }
                      ]
                    });
                  }
                  
                  // Add draws to local fights array
                  const meronFight = {
                    id: fightNumber + 1,
                    entryName: meronEntry.entryName,
                    legBand: selectedMeronLegBand || 'unknown',
                    legBandFought: selectedMeronLegBand || 'unknown',
                    result: 0.5  // 0.5 for draw
                  };
                  const walaFight = {
                    id: fightNumber + 1,
                    entryName: walaEntry.entryName,
                    legBand: selectedWalaLegBand || 'unknown',
                    legBandFought: selectedWalaLegBand || 'unknown',
                    result: 0.5  // 0.5 for draw
                  };
                  
                  const newFights = [...fights, meronFight, walaFight];
                  setFights(newFights);
                  
                  // Only record if there are known entries
                  let recordSuccess = true;
                  if (entryResults.length > 0) {
                    recordSuccess = await recordEntryResults(entryResults);
                  }
                  
                  if (!recordSuccess) {
                    setError('Failed to record draw. Please try again.');
                    setTimeout(() => setError(''), 3000);
                    return;
                  }
                  
                  setFightNumber(fightNumber + 1);
                  setSelectedMeronEntry('');
                  setSelectedMeronLegBand('');
                  setMeronLegBandSearch('');
                  setSelectedWalaEntry('');
                  setSelectedWalaLegBand('');
                  setWalaLegBandSearch('');
                  setSuccess('Draw recorded! Moving to next fight.');
                  setTimeout(() => setSuccess(''), 3000);
                  
                  // Reload game data to sync
                  await loadGameData();
                }
              }}
              disabled={!selectedMeronEntry || !selectedWalaEntry || (selectedMeronLegBand && usedLegBands.has(selectedMeronLegBand)) || (selectedWalaLegBand && usedLegBands.has(selectedWalaLegBand))}
              className={`w-full py-3 font-bold rounded-lg text-lg transition ${
                selectedMeronEntry && selectedWalaEntry && (!selectedMeronLegBand || !usedLegBands.has(selectedMeronLegBand)) && (!selectedWalaLegBand || !usedLegBands.has(selectedWalaLegBand))
                  ? 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
                  : 'bg-green-900 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              DRAW
            </button>

            {/* Cancel Fight Button */}
            <button
              onClick={async () => {
                if (selectedMeronEntry && selectedWalaEntry) {
                  // Check if either leg band has already been used
                  if (usedLegBands.has(selectedMeronLegBand)) {
                    setError(`Leg band ${selectedMeronLegBand} (Meron) has already fought`);
                    return;
                  }
                  if (usedLegBands.has(selectedWalaLegBand)) {
                    setError(`Leg band ${selectedWalaLegBand} (Wala) has already fought`);
                    return;
                  }
                  
                  // Build entry results for cancellation (both entries get 'cancelled' result)
                  const entryResults = [];
                  
                  // Always add entries to entryResults for cancelled fights, even if unknown
                  // Meron entry
                  entryResults.push({
                    entryId: meronEntry?._id || `unknown-meron-${Date.now()}`,
                    entryName: meronEntry?.entryName || 'Unknown Entry (Meron)',
                    gameType: meronEntry?.gameType || 'unknown',
                    legResults: [
                      { legNumber: fightNumber + 1, result: 'cancelled' }
                    ]
                  });
                  
                  // Wala entry
                  entryResults.push({
                    entryId: walaEntry?._id || `unknown-wala-${Date.now()}`,
                    entryName: walaEntry?.entryName || 'Unknown Entry (Wala)',
                    gameType: walaEntry?.gameType || 'unknown',
                    legResults: [
                      { legNumber: fightNumber + 1, result: 'cancelled' }
                    ]
                  });
                  
                  // Add cancelled fights to local fights array (but don't mark leg bands as used)
                  const meronFight = {
                    id: fightNumber + 1,
                    entryName: meronEntry?.entryName || 'Unknown Entry (Meron)',
                    gameType: meronEntry?.gameType || 'unknown',
                    legBand: selectedMeronLegBand || 'unknown',
                    legBandFought: selectedMeronLegBand || 'unknown',
                    result: 'cancelled'  // Special cancelled result
                  };
                  const walaFight = {
                    id: fightNumber + 1,
                    entryName: walaEntry?.entryName || 'Unknown Entry (Wala)',
                    gameType: walaEntry?.gameType || 'unknown',
                    legBand: selectedWalaLegBand || 'unknown',
                    legBandFought: selectedWalaLegBand || 'unknown',
                    result: 'cancelled'  // Special cancelled result
                  };
                  
                  const newFights = [...fights, meronFight, walaFight];
                  setFights(newFights);
                  
                  // Record results to backend (now always records since entryResults is always populated)
                  const recordSuccess = await recordEntryResults(entryResults);
                  
                  if (!recordSuccess) {
                    setError('Failed to record cancellation. Please try again.');
                    setTimeout(() => setError(''), 3000);
                    return;
                  }
                  
                  setFightNumber(fightNumber + 1);
                  setSelectedMeronEntry('');
                  setSelectedMeronLegBand('');
                  setMeronLegBandSearch('');
                  setMeronLegBandEntries([]); // Clear multiple entries state
                  setSelectedWalaEntry('');
                  setSelectedWalaLegBand('');
                  setWalaLegBandSearch('');
                  setWalaLegBandEntries([]); // Clear multiple entries state
                  setSuccess('Fight cancelled! Entries can be reused.');
                  setTimeout(() => setSuccess(''), 3000);
                  
                  // Reload game data to sync
                  await loadGameData();
                }
              }}
              disabled={!selectedMeronEntry || !selectedWalaEntry || (selectedMeronLegBand && usedLegBands.has(selectedMeronLegBand)) || (selectedWalaLegBand && usedLegBands.has(selectedWalaLegBand))}
              className={`w-full py-3 font-bold rounded-lg text-lg transition mt-2 ${
                selectedMeronEntry && selectedWalaEntry && (!selectedMeronLegBand || !usedLegBands.has(selectedMeronLegBand)) && (!selectedWalaLegBand || !usedLegBands.has(selectedWalaLegBand))
                  ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                  : 'bg-red-900 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              CANCEL FIGHT
            </button>
          </div>

          {/* Wala Column */}
          <div className="bg-blue-700 text-white rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">WALA</h2>
            
            {/* Leg Band Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Search Leg Band</label>
              <input
                type="text"
                value={walaLegBandSearch}
                onChange={(e) => handleWalaLegBandSearch(e.target.value)}
                placeholder="Enter leg band number or '000' for unknown..."
                className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white border border-blue-500 placeholder-blue-300"
              />
              
              {/* Entry selection for multiple entries with same leg band */}
              {walaLegBandEntries.length > 1 && (
                <div className="mt-2">
                  <label className="block text-xs font-medium mb-1">Multiple entries found - select one:</label>
                  <select
                    value={selectedWalaEntry}
                    onChange={(e) => {
                      setSelectedWalaEntry(e.target.value);
                      setWalaLegBandEntries([]); // Clear multiple entries after selection
                    }}
                    className="w-full px-3 py-1 rounded bg-blue-600 text-white border border-blue-500 text-sm"
                  >
                    <option value="">Choose entry...</option>
                    {walaLegBandEntries.map(entry => (
                      <option key={entry._id} value={entry._id}>
                        {entry.entryName} ({entry.gameType})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {walaLegBandSearch && selectedWalaEntry && walaLegBandEntries.length <= 1 && (
                <div className="mt-2 p-2 bg-blue-600 rounded text-sm">
                  <div className="font-medium">{walaEntry?.entryName}</div>
                  <div className="text-xs">
                    Leg Band: {walaLegBandSearch === '000' ? 'Unknown (000)' : selectedWalaLegBand}
                  </div>
                </div>
              )}
            </div>
            
            {/* Entry Selection Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Or Select Entry</label>
              <select
                value={selectedWalaEntry}
                onChange={(e) => {
                  setSelectedWalaEntry(e.target.value);
                  setSelectedWalaLegBand(''); // Clear leg band when manually selecting entry
                  setWalaLegBandSearch('');
                  setWalaLegBandEntries([]); // Clear multiple entries state
                  if (e.target.value) {
                    const entry = entries.find(ent => ent._id === e.target.value);
                    if (entry && entry.legBandNumbers && entry.legBandNumbers.length > 0) {
                      // If entry has leg bands, auto-select the first available one
                      const availableBands = entry.legBandNumbers.filter(band => !usedLegBands.has(band));
                      if (availableBands.length > 0) {
                        setSelectedWalaLegBand(availableBands[0]);
                      }
                    }
                  }
                }}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white border border-blue-500"
              >
                <option value="">Choose an entry...</option>
                {availableWalaEntries.map(entry => (
                  <option key={entry._id} value={entry._id}>
                    {entry.entryName} ({entry.legBandNumbers && entry.legBandNumbers.length > 0 ? `${entry.legBandNumbers.length} leg band(s)` : 'Unknown'})
                  </option>
                ))}
              </select>
            </div>

            {/* Show selected entry score */}
            {selectedWalaEntry && walaEntry && (
              <div className="mb-4 p-3 bg-blue-600 rounded text-sm">
                <div className="font-medium mb-2">Entry Score</div>
                <div className="space-y-2">
                  <div className="text-sm font-bold">{walaEntry.entryName}</div>
                  <div className="text-xs text-blue-100">Type: {walaEntry.gameType}</div>
                  <div className="border-t border-blue-500 pt-2 mt-2">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs">Total Fights:</span>
                      <span className="text-sm font-bold">{fights.filter(f => f.entryName === walaEntry.entryName).length}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs">Wins:</span>
                      <span className="text-lg font-bold text-yellow-300">{fights.filter(f => f.entryName === walaEntry.entryName && f.result === 1).length}</span>
                    </div>
                    {/* Fight Sequence */}
                    <div className="text-center">
                      <div className="text-xs text-blue-200 mb-1">Sequence:</div>
                      <div className="text-2xl font-bold tracking-wider">
                        {fights.filter(f => f.entryName === walaEntry.entryName)
                          .map(f => f.result === 1 ? '1' : f.result === 0.5 ? '½' : '0')
                          .join('') || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Win Button */}
            <button
              onClick={handleWalaWin}
              disabled={!selectedMeronEntry || !selectedWalaEntry || (selectedMeronLegBand && usedLegBands.has(selectedMeronLegBand)) || (selectedWalaLegBand && usedLegBands.has(selectedWalaLegBand))}
              className={`w-full py-3 font-bold rounded-lg text-lg transition ${
                selectedMeronEntry && selectedWalaEntry && (!selectedMeronLegBand || !usedLegBands.has(selectedMeronLegBand)) && (!selectedWalaLegBand || !usedLegBands.has(selectedWalaLegBand))
                  ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                  : 'bg-blue-900 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              WALA WINS
            </button>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="mb-8">
            <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>💰 Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
              {/* Total Registered - Based on Manage Entries */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>TOTAL REGISTERED</div>
                <div className={`text-4xl font-bold mt-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {entries.length}
                </div>
              </div>

              {/* 2-Wins Paid - Based on Manage Entries */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-red-900/30 to-red-900/20 border-red-700' : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>2-WINS REGISTERED</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                  {(() => {
                    const by2wins = entries.filter(e => e.gameType === '2wins').length;
                    const paid2wins = registrations.filter(reg => {
                      const entry = entries.find(e => e.entryName === reg.entryName);
                      return entry?.gameType === '2wins' && reg.registrations.find(r => r.gameType === '2wins' && r.isPaid);
                    }).length;
                    return `${paid2wins}/${by2wins}`;
                  })()}
                </div>
                <div className={`text-xs mt-1 font-mono ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
                  ₱{(() => {
                    const total = registrations.reduce((sum, reg) => {
                      const entry = entries.find(e => e.entryName === reg.entryName);
                      const reg2wins = reg.registrations.find(r => r.gameType === '2wins' && r.isPaid);
                      const fee = reg2wins?.registrationFee;
                      console.log(`Registration fee for ${reg.entryName}:`, fee, typeof fee);
                      return entry?.gameType === '2wins' && reg2wins ? sum + (Number(fee) || 300) : sum;
                    }, 0);
                    console.log('Total 2-wins revenue:', total);
                    return total;
                  })()}
                </div>
              </div>

              {/* 3-Wins Paid - Based on Manage Entries */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-blue-900/30 to-blue-900/20 border-blue-700' : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>3-WINS REGISTERED</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {(() => {
                    const by3wins = entries.filter(e => e.gameType === '3wins').length;
                    const paid3wins = registrations.filter(reg => {
                      const entry = entries.find(e => e.entryName === reg.entryName);
                      return entry?.gameType === '3wins' && reg.registrations.find(r => r.gameType === '3wins' && r.isPaid);
                    }).length;
                    return `${paid3wins}/${by3wins}`;
                  })()}
                </div>
                <div className={`text-xs mt-1 font-mono ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                  ₱{(() => {
                    const paid3wins = registrations.filter(reg => {
                      const entry = entries.find(e => e.entryName === reg.entryName);
                      return entry?.gameType === '3wins' && reg.registrations.find(r => r.gameType === '3wins' && r.isPaid);
                    }).length;
                    return paid3wins * 1000;
                  })()}
                </div>
              </div>

              {/* Champion 2-Wins */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-orange-900/30 to-orange-900/20 border-orange-700' : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>CHAMPION 2-WINS</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                  ₱{(() => {
                    const meronChampionCount = Object.entries(
                      fights.reduce((acc, fight) => {
                        const entry = entries.find(e => e.entryName === fight.entryName);
                        const registration = registrations.find(r => r.entryName === fight.entryName);
                        if (entry?.gameType === '2wins' && fight.result === 1 && registration?.isValidChampion !== false) {
                          acc[fight.entryName] = (acc[fight.entryName] || 0) + 1;
                        }
                        return acc;
                      }, {})
                    ).filter(([_, wins]) => wins >= 2).length;
                    return meronChampionCount * 5000;
                  })()}
                </div>
              </div>

              {/* Champion 3-Wins */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-cyan-900/30 to-cyan-900/20 border-cyan-700' : 'bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>CHAMPION 3-WINS</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                  ₱{(() => {
                    const walaChampionCount = Object.entries(
                      fights.reduce((acc, fight) => {
                        const entry = entries.find(e => e.entryName === fight.entryName);
                        const registration = registrations.find(r => r.entryName === fight.entryName);
                        if (entry?.gameType === '3wins' && fight.result === 1 && registration?.isValidChampion !== false) {
                          acc[fight.entryName] = (acc[fight.entryName] || 0) + 1;
                        }
                        return acc;
                      }, {})
                    ).filter(([_, wins]) => wins >= 3).length;
                    return walaChampionCount * 20000;
                  })()}
                </div>
              </div>

              {/* Insurance */}
              <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gradient-to-br from-purple-900/30 to-purple-900/20 border-purple-700' : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>INSURANCE</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                  ₱{(() => {
                    const insuranceCount = registrations.filter(r => r.insurancePaid).length;
                    return insuranceCount * 5000;
                  })()}
                </div>
                <div className={`text-xs mt-1 ${isDarkMode ? 'text-purple-300' : 'text-purple-600'}`}>{registrations.filter(r => r.insurancePaid).length} entries</div>
              </div>

              {/* Net Revenue */}
              <div className={`p-4 rounded-lg border md:col-span-2 lg:col-span-1 ${isDarkMode ? 'bg-gradient-to-br from-green-900/30 to-green-900/20 border-green-700' : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'} shadow-md hover:shadow-lg transition`}>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>NET REVENUE</div>
                <div className={`text-3xl font-bold mt-2 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                  ₱{(() => {
                    const totalCollected = stats.totalRevenue || 0;
                    const meronChampionCount = Object.entries(
                      fights.reduce((acc, fight) => {
                        const entry = entries.find(e => e.entryName === fight.entryName);
                        const registration = registrations.find(r => r.entryName === fight.entryName);
                        if (entry?.gameType === '2wins' && fight.result === 1 && registration?.isValidChampion !== false) {
                          acc[fight.entryName] = (acc[fight.entryName] || 0) + 1;
                        }
                        return acc;
                      }, {})
                    ).filter(([_, wins]) => wins >= 2).length;
                    const meronChampionPayout = meronChampionCount * 5000;
                    
                    const walaChampionCount = Object.entries(
                      fights.reduce((acc, fight) => {
                        const entry = entries.find(e => e.entryName === fight.entryName);
                        const registration = registrations.find(r => r.entryName === fight.entryName);
                        if (entry?.gameType === '3wins' && fight.result === 1 && registration?.isValidChampion !== false) {
                          acc[fight.entryName] = (acc[fight.entryName] || 0) + 1;
                        }
                        return acc;
                      }, {})
                    ).filter(([_, wins]) => wins >= 3).length;
                    const walaChampionPayout = walaChampionCount * 20000;
                    
                    const insuranceCount = registrations.filter(r => r.insurancePaid).length;
                    const insuranceTotal = insuranceCount * 5000;
                    
                    const netRevenue = totalCollected - meronChampionPayout - walaChampionPayout - insuranceTotal;
                    return Math.max(0, netRevenue);
                  })()}
                </div>
                <div className={`text-xs mt-1 font-mono ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Gross - Payouts</div>
              </div>
            </div>
          </div>
        )}

        {/* Register Entry Form Modal */}
        {showRegForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-lg p-6 w-full max-w-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Register Entry</h3>
              
              {/* Entry Selection */}
              <div className="mb-4">
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select Entry
                </label>
                <select
                  value={selectedEntry}
                  onChange={(e) => setSelectedEntry(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <option value="">Choose an entry...</option>
                  {entries.map(entry => (
                    <option key={entry._id} value={entry._id}>
                      {entry.entryName} ({entry.gameType.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Game Type Selection */}
              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="2wins"
                    checked={selected2Wins}
                    onChange={(e) => setSelected2Wins(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="2wins" className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    2-Wins
                  </label>
                  
                  {/* 2-Wins Fee Selection */}
                  {selected2Wins && (
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => setSelected2WinsFee(300)}
                        className={`px-3 py-1 text-sm rounded ${
                          selected2WinsFee === 300
                            ? isDarkMode ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
                            : isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200'
                        }`}
                      >
                        ₱300
                      </button>
                      <button
                        onClick={() => setSelected2WinsFee(500)}
                        className={`px-3 py-1 text-sm rounded ${
                          selected2WinsFee === 500
                            ? isDarkMode ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
                            : isDarkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200'
                        }`}
                      >
                        ₱500
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="3wins"
                    checked={selected3Wins}
                    onChange={(e) => setSelected3Wins(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="3wins" className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    3-Wins (₱1,000)
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRegForm(false);
                    setSelectedEntry('');
                    setSelected2Wins(false);
                    setSelected2WinsFee(500);
                    setSelected3Wins(false);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                    isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegisterEntry}
                  disabled={submittingReg || !selectedEntry || (!selected2Wins && !selected3Wins)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-white ${
                    submittingReg || !selectedEntry || (!selected2Wins && !selected3Wins)
                      ? isDarkMode ? 'bg-blue-900 cursor-not-allowed' : 'bg-blue-300 cursor-not-allowed'
                      : isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  {submittingReg ? 'Registering...' : 'Register'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Registrations Table */}
        <div>
          {/* Global 2-Wins Fee Selector */}
          <div className={`rounded-lg p-4 mb-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} border`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  2-Wins Registration Fee (Global Default)
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  Choose the default fee for all 2-Wins registrations
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setGlobal2WinsFee(300)}
                  className={`px-4 py-2 rounded-lg font-bold transition ${
                    global2WinsFee === 300
                      ? isDarkMode ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
                      : isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  ₱300
                </button>
                <button
                  onClick={() => setGlobal2WinsFee(500)}
                  className={`px-4 py-2 rounded-lg font-bold transition ${
                    global2WinsFee === 500
                      ? isDarkMode ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
                      : isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  ₱500
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Registrations
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleMarkAllPaid}
                disabled={submittingReg || registrations.length === 0 || !registrations.some(reg => reg.registrations.some(r => !r.isPaid))}
                className={`px-4 py-2 rounded-lg font-medium text-white transition ${
                  submittingReg || registrations.length === 0 || !registrations.some(reg => reg.registrations.some(r => !r.isPaid))
                    ? isDarkMode ? 'bg-green-900 cursor-not-allowed opacity-50' : 'bg-green-300 cursor-not-allowed opacity-50'
                    : isDarkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {submittingReg ? 'Processing...' : 'Mark All Paid'}
              </button>
              <button
                onClick={handleWithdrawAllPaid}
                disabled={submittingReg || registrations.length === 0 || !registrations.some(reg => reg.registrations.some(r => r.isPaid))}
                className={`px-4 py-2 rounded-lg font-medium text-white transition ${
                  submittingReg || registrations.length === 0 || !registrations.some(reg => reg.registrations.some(r => r.isPaid))
                    ? isDarkMode ? 'bg-red-900 cursor-not-allowed opacity-50' : 'bg-red-300 cursor-not-allowed opacity-50'
                    : isDarkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {submittingReg ? 'Processing...' : 'Withdraw All'}
              </button>
              <button
                onClick={() => setShowRegForm(true)}
                className={`px-4 py-2 rounded-lg font-medium text-white transition ${
                  isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                + Register Entry
              </button>
            </div>
          </div>
          {registrationsLoading ? (
            <div className="flex justify-center py-12">
              <Loader className="animate-spin text-blue-600" size={32} />
            </div>
          ) : registrations.length === 0 ? (
            <div className={`p-8 text-center rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>No registrations yet</p>
            </div>
          ) : (
            <div className={`rounded-lg overflow-hidden shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <table className="w-full">
                <thead>
                  <tr className={isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}>
                    <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Entry Name</th>
                    <th className={`px-6 py-3 text-center font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>2-Wins (₱{global2WinsFee})</th>
                    <th className={`px-6 py-3 text-center font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>3-Wins (₱1,000)</th>
                    <th className={`px-6 py-3 text-center font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Insurance</th>
                    <th className={`px-6 py-3 text-left font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Deduplicate by entry name - keep only latest version of each entry
                    const entryMap = new Map();
                    registrations.forEach(reg => {
                      const entryName = reg.entryName;
                      const existing = entryMap.get(entryName);
                      if (!existing) {
                        entryMap.set(entryName, reg);
                      } else {
                        // Keep the one with more recent updatedAt
                        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                        const newTime = new Date(reg.updatedAt || reg.createdAt || 0).getTime();
                        if (newTime > existingTime) {
                          entryMap.set(entryName, reg);
                        }
                      }
                    });
                    
                    // Filter to only show entries that exist in the Manage Entries page
                    const validEntryNames = new Set(entries.map(e => e.entryName));
                    const filteredRegistrations = Array.from(entryMap.values()).filter(reg => validEntryNames.has(reg.entryName));
                    
                    return filteredRegistrations.map((reg) => {
                      const reg2wins = reg.registrations.find(r => r.gameType === '2wins');
                      const reg3wins = reg.registrations.find(r => r.gameType === '3wins');
                      const entry = entries.find(e => e.entryName === reg.entryName);

                    return (
                      <tr key={reg._id} className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <td className={`px-6 py-4 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          <div className="flex items-center gap-2">
                            <span>{reg.entryName}</span>
                            {entry && (
                              <span className={`px-2 py-1 text-xs font-bold rounded ${
                                entry.gameType === '2wins'
                                  ? isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'
                                  : isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {entry.gameType === '2wins' ? '2-WINS' : '3-WINS'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {reg2wins && entry?.gameType === '2wins' ? (
                            reg2wins.isPaid ? (
                              <button
                                onClick={() => handleWithdrawPayment(reg._id, '2wins')}
                                className={`px-3 py-1 text-xs rounded font-medium ${
                                  isDarkMode ? 'bg-yellow-900 text-yellow-200 hover:bg-yellow-800' : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                Withdraw
                              </button>
                            ) : (
                              <button
                                onClick={() => handleMarkPaid(reg._id, '2wins')}
                                className={`px-3 py-1 text-xs rounded font-medium ${
                                  isDarkMode ? 'bg-green-900 text-green-200 hover:bg-green-800' : 'bg-green-100 text-green-700'
                                }`}
                              >
                                Mark Paid
                              </button>
                            )
                          ) : <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>-</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {reg3wins && entry?.gameType === '3wins' ? (
                            reg3wins.isPaid ? (
                              <button
                                onClick={() => handleWithdrawPayment(reg._id, '3wins')}
                                className={`px-3 py-1 text-xs rounded font-medium ${
                                  isDarkMode ? 'bg-yellow-900 text-yellow-200 hover:bg-yellow-800' : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                Withdraw
                              </button>
                            ) : (
                              <button
                                onClick={() => handleMarkPaid(reg._id, '3wins')}
                                className={`px-3 py-1 text-xs rounded font-medium ${
                                  isDarkMode ? 'bg-green-900 text-green-200 hover:bg-green-800' : 'bg-green-100 text-green-700'
                                }`}
                              >
                                Mark Paid
                              </button>
                            )
                          ) : <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>-</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {entry?.gameType === '3wins' ? (
                            <div className="flex flex-col items-center gap-2">
                              <span className={reg.insurancePaid ? 'text-purple-600 font-bold text-sm' : 'text-gray-600 text-sm'}>
                                {reg.insurancePaid ? '✓' : '✗'}
                              </span>
                              <button
                                onClick={() => handleInsurance(reg._id)}
                                className={`px-3 py-1 text-xs rounded font-medium ${
                                  reg.insurancePaid
                                    ? 'bg-green-100 text-green-700'
                                    : isDarkMode ? 'bg-purple-900 text-purple-200 hover:bg-purple-800' : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {reg.insurancePaid ? '✓' : 'Add'}
                              </button>
                            </div>
                          ) : <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>-</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleValidChampion(reg._id, reg.isValidChampion)}
                              className={`px-3 py-1 text-xs rounded font-medium ${
                                reg.isValidChampion === false
                                  ? isDarkMode ? 'bg-red-900 text-red-200 hover:bg-red-800' : 'bg-red-100 text-red-700'
                                  : isDarkMode ? 'bg-green-900 text-green-200 hover:bg-green-800' : 'bg-green-100 text-green-700'
                              }`}
                              title={reg.isValidChampion === false ? 'Mark as valid champion' : 'Mark as invalid champion'}
                            >
                              {reg.isValidChampion === false ? '❌' : '✓'}
                            </button>
                            <button
                              onClick={() => handleDeleteRegistration(reg._id)}
                              className={`px-3 py-1 text-xs rounded font-medium ${
                                isDarkMode ? 'bg-red-900 text-red-200 hover:bg-red-800' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => {
                                const gameTypes = [];
                                if (reg.registrations.find(r => r.gameType === '2wins')?.isPaid) gameTypes.push('2wins');
                                if (reg.registrations.find(r => r.gameType === '3wins')?.isPaid) gameTypes.push('3wins');
                                if (gameTypes.length > 0) {
                                  gameTypes.forEach(gt => handleWithdrawPayment(reg._id, gt));
                                }
                              }}
                              disabled={!reg.registrations.some(r => r.isPaid)}
                              className={`px-3 py-1 text-xs rounded font-medium ${
                                reg.registrations.some(r => r.isPaid)
                                  ? isDarkMode ? 'bg-yellow-900 text-yellow-200 hover:bg-yellow-800' : 'bg-yellow-100 text-yellow-700'
                                  : isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              Withdraw
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
