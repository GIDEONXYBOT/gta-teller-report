import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AlertCircle, Plus, Loader, Trash2, X, Check, Edit2 } from 'lucide-react';
import { SettingsContext } from '../context/SettingsContext';
import { getApiUrl } from '../utils/apiConfig';

export default function ChickenFightEntries() {
  const { isDarkMode } = useContext(SettingsContext);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [gameType, setGameType] = useState('2wins');
  const [entryName, setEntryName] = useState('');
  const [legBands, setLegBands] = useState(['', '']);
  const [legBandDetails, setLegBandDetails] = useState([
    { legBand: '', featherType: '' },
    { legBand: '', featherType: '' }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  
  // Edit mode
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState(null);

  // Fetch entries
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${getApiUrl()}/api/chicken-fight/entries`);
      if (response.data.success) {
        setEntries(response.data.entries || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // Handle game type change
  const handleGameTypeChange = (type) => {
    setGameType(type);
    if (type === '2wins') {
      setLegBands(['', '']);
      setLegBandDetails([
        { legBand: '', featherType: '' },
        { legBand: '', featherType: '' }
      ]);
    } else if (type === '3wins') {
      setLegBands(['', '', '']);
      setLegBandDetails([
        { legBand: '', featherType: '' },
        { legBand: '', featherType: '' },
        { legBand: '', featherType: '' }
      ]);
    }
  };

  // Handle leg band input change
  const handleLegBandChange = (index, value) => {
    const newLegBands = [...legBands];
    newLegBands[index] = value;
    setLegBands(newLegBands);
    
    // Update corresponding detail
    const newDetails = [...legBandDetails];
    newDetails[index].legBand = value;
    setLegBandDetails(newDetails);
  };

  // Handle feather type change
  const handleFeatherTypeChange = (index, value) => {
    const newDetails = [...legBandDetails];
    newDetails[index].featherType = value;
    setLegBandDetails(newDetails);
  };

  // Submit new entry
  const handleSubmitEntry = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (!entryName.trim()) {
        setError('Entry name is required');
        setSubmitting(false);
        return;
      }

      if (legBands.some(band => !band.trim())) {
        setError('All leg band numbers are required');
        setSubmitting(false);
        return;
      }

      // Check for duplicate entry name (excluding current entry if editing)
      const isDuplicateEntryName = entries.some(
        entry => entry.entryName.toLowerCase() === entryName.trim().toLowerCase() && 
        entry._id !== editingId
      );
      if (isDuplicateEntryName) {
        setError(`Entry name "${entryName}" already exists`);
        setSubmitting(false);
        return;
      }

      // Check for duplicate leg bands within the same game type (excluding current entry if editing)
      const sameGameTypeEntries = entries
        .filter(entry => entry.gameType === gameType && entry._id !== editingId); // Only check same game type, exclude current entry if editing
      
      const allExistingLegBandsInSameGameType = sameGameTypeEntries
        .flatMap(entry => entry.legBandNumbers);
      
      const duplicateLegBands = legBands
        .map(b => b.trim())
        .filter(band => allExistingLegBandsInSameGameType.includes(band));
      
      if (duplicateLegBands.length > 0) {
        setError(`Leg band(s) ${duplicateLegBands.join(', ')} already exist in other ${gameType} entries`);
        setSubmitting(false);
        return;
      }

      if (editingId) {
        // Update existing entry
        const response = await axios.put(`${getApiUrl()}/api/chicken-fight/entries/${editingId}`, {
          entryName: entryName.trim(),
          legBandNumbers: legBands.map(b => b.trim()),
          legBandDetails
        });

        if (response.data.success) {
          setSuccess(`Entry "${entryName}" updated successfully!`);
          setEditingId(null);
          setEntryName('');
          setLegBands(gameType === '2wins' ? ['', ''] : ['', '', '']);
          setLegBandDetails(gameType === '2wins' 
            ? [{ legBand: '', featherType: '' }, { legBand: '', featherType: '' }]
            : [{ legBand: '', featherType: '' }, { legBand: '', featherType: '' }, { legBand: '', featherType: '' }]
          );
          fetchEntries();
          setTimeout(() => setSuccess(''), 3000);
        }
      } else {
        // Create new entry
        const response = await axios.post(`${getApiUrl()}/api/chicken-fight/entries`, {
          entryName: entryName.trim(),
          gameType,
          legBandNumbers: legBands.map(b => b.trim()),
          legBandDetails
        });

        if (response.data.success) {
          setSuccess(`Entry "${entryName}" created successfully!`);
          setEntryName('');
          setLegBands(gameType === '2wins' ? ['', ''] : ['', '', '']);
          setLegBandDetails(gameType === '2wins' 
            ? [{ legBand: '', featherType: '' }, { legBand: '', featherType: '' }]
            : [{ legBand: '', featherType: '' }, { legBand: '', featherType: '' }, { legBand: '', featherType: '' }]
          );
          fetchEntries();
          setTimeout(() => setSuccess(''), 3000);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete entry
  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    setDeleting(id);
    try {
      const response = await axios.delete(`${getApiUrl()}/api/chicken-fight/entries/${id}`);
      if (response.data.success) {
        setSuccess('Entry deleted successfully!');
        fetchEntries();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete entry');
    } finally {
      setDeleting(null);
    }
  };

  // Edit entry
  const handleEditEntry = (entry) => {
    setEditingId(entry._id);
    setEntryName(entry.entryName);
    setGameType(entry.gameType);
    setLegBands(entry.legBandNumbers);
    setLegBandDetails(entry.legBandDetails || entry.legBandNumbers.map(band => ({
      legBand: band,
      featherType: ''
    })));
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEntryName('');
    setGameType('2wins');
    setLegBands(['', '']);
    setLegBandDetails([
      { legBand: '', featherType: '' },
      { legBand: '', featherType: '' }
    ]);
  };

  // Group entries by game type
  const entries2Wins = entries.filter(e => e.gameType === '2wins');
  const entries3Wins = entries.filter(e => e.gameType === '3wins');

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header */}
      <div className={`${isDarkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-r from-white to-gray-50 border-gray-200'} border-b sticky top-0 z-10 shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            🐓 Manage Entries
          </h1>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-2 text-lg`}>
            Add, manage, and organize entries for 2-Wins and 3-Wins competitions
          </p>
        </div>
      </div>

      {/* Alerts */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-3">
        {error && (
          <div className={`p-4 rounded-lg flex items-center gap-3 border ${isDarkMode ? 'bg-red-900/30 text-red-300 border-red-600' : 'bg-red-50 text-red-800 border-red-300'}`}>
            <AlertCircle size={20} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="hover:opacity-70"><X size={18} /></button>
          </div>
        )}
        {success && (
          <div className={`p-4 rounded-lg flex items-center gap-3 border ${isDarkMode ? 'bg-green-900/30 text-green-300 border-green-600' : 'bg-green-50 text-green-800 border-green-300'}`}>
            <Check size={20} />
            <span className="flex-1">{success}</span>
            <button onClick={() => setSuccess('')} className="hover:opacity-70"><X size={18} /></button>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Entry Form - Left/Top */}
          <div className={`lg:col-span-1 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-8 h-fit shadow-lg hover:shadow-xl transition`}>
            <h2 className={`text-2xl font-bold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {editingId ? (
                <>
                  <Edit2 size={24} className="text-blue-500" />
                  Edit Entry
                </>
              ) : (
                <>
                  <Plus size={24} className="text-green-500" />
                  Add Entry
                </>
              )}
            </h2>

            <form onSubmit={handleSubmitEntry} className="space-y-5">
              {/* Entry Name */}
              <div>
                <label className={`block text-sm font-bold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Entry Name
                </label>
                <input
                  type="text"
                  value={entryName}
                  onChange={(e) => setEntryName(e.target.value)}
                  placeholder="e.g., Red Tiger"
                  className={`w-full px-4 py-3 rounded-lg border transition ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:bg-gray-600'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                />
              </div>

              {/* Game Type Tabs */}
              <div>
                <label className={`block text-sm font-bold mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Competition Type {editingId && <span className="text-xs opacity-75">(cannot change)</span>}
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleGameTypeChange('2wins')}
                    disabled={editingId !== null}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm transition duration-200 ${
                      editingId ? 'opacity-50 cursor-not-allowed' : ''
                    } ${
                      gameType === '2wins'
                        ? isDarkMode
                          ? 'bg-red-600 text-white shadow-lg shadow-red-600/50'
                          : 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    2-Wins
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGameTypeChange('3wins')}
                    disabled={editingId !== null}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm transition duration-200 ${
                      editingId ? 'opacity-50 cursor-not-allowed' : ''
                    } ${
                      gameType === '3wins'
                        ? isDarkMode
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                          : 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    3-Wins
                  </button>
                </div>
              </div>

              {/* Leg Bands with Feather Types */}
              <div>
                <label className={`block text-sm font-bold mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Leg Band Numbers & Feather Types ({legBands.length})
                </label>
                <div className="space-y-3">
                  {legBands.map((band, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={band}
                        onChange={(e) => handleLegBandChange(index, e.target.value)}
                        placeholder={`Band ${index + 1}`}
                        className={`px-4 py-3 rounded-lg border transition font-mono ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:bg-gray-600'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        }`}
                      />
                      <input
                        type="text"
                        value={legBandDetails[index]?.featherType || ''}
                        onChange={(e) => handleFeatherTypeChange(index, e.target.value)}
                        placeholder="Feather type"
                        className={`px-4 py-3 rounded-lg border transition ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:bg-gray-600'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 py-3 rounded-lg font-bold transition duration-200 flex items-center justify-center gap-2 ${
                    submitting
                      ? isDarkMode
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : isDarkMode
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-600/50'
                      : 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-green-500/50'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      {editingId ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      {editingId ? 'Update Entry' : 'Add Entry'}
                    </>
                  )}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className={`px-4 py-3 rounded-lg font-bold transition ${
                      isDarkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lists Side by Side */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 2-Wins Column */}
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-8 shadow-lg hover:shadow-xl transition`}>
              <h2 className={`text-2xl font-bold mb-6 flex items-center gap-3 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                2-Wins <span className={`text-sm font-normal ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>({entries2Wins.length})</span>
              </h2>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader size={28} className={`animate-spin ${isDarkMode ? 'text-red-500' : 'text-red-500'}`} />
                </div>
              ) : entries2Wins.length === 0 ? (
                <div className={`text-center py-12 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  <p className="text-lg">No entries yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {entries2Wins.map(entry => (
                    <div
                      key={entry._id}
                      className={`${isDarkMode ? 'bg-red-900/20 hover:bg-red-900/30 border-red-700' : 'bg-red-50 hover:bg-red-100 border-red-200'} border rounded-lg p-4 flex justify-between items-start gap-3 group transition`}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold text-lg ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                          {entry.entryName}
                        </h3>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {entry.legBandNumbers.map((band, idx) => {
                            const detail = entry.legBandDetails?.find(d => d.legBand === band);
                            const featherType = detail?.featherType || 'Unknown';
                            return (
                              <div key={idx} className={`px-2 py-1 text-xs rounded-lg ${
                                isDarkMode
                                  ? 'bg-red-900/50 text-red-200 border border-red-700'
                                  : 'bg-red-200 text-red-800 border border-red-300'
                              }`}>
                                <div className="font-mono font-bold">#{band}</div>
                                <div className="text-xs opacity-75">{featherType}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleEditEntry(entry)}
                          className={`p-2 rounded-lg transition ${
                            isDarkMode
                              ? 'text-blue-400 hover:bg-blue-900/40 hover:text-blue-300'
                              : 'text-blue-600 hover:bg-blue-200'
                          }`}
                          title="Edit entry"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry._id)}
                          disabled={deleting === entry._id}
                          className={`p-2 rounded-lg transition ${
                            deleting === entry._id
                              ? 'opacity-100 text-gray-500 cursor-not-allowed'
                              : isDarkMode
                              ? 'text-red-400 hover:bg-red-900/40 hover:text-red-300'
                              : 'text-red-600 hover:bg-red-200'
                          }`}
                          title="Delete entry"
                        >
                          {deleting === entry._id ? <Loader size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3-Wins Column */}
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-8 shadow-lg hover:shadow-xl transition`}>
              <h2 className={`text-2xl font-bold mb-6 flex items-center gap-3 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                3-Wins <span className={`text-sm font-normal ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>({entries3Wins.length})</span>
              </h2>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader size={28} className={`animate-spin ${isDarkMode ? 'text-blue-500' : 'text-blue-500'}`} />
                </div>
              ) : entries3Wins.length === 0 ? (
                <div className={`text-center py-12 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  <p className="text-lg">No entries yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {entries3Wins.map(entry => (
                    <div
                      key={entry._id}
                      className={`${isDarkMode ? 'bg-blue-900/20 hover:bg-blue-900/30 border-blue-700' : 'bg-blue-50 hover:bg-blue-100 border-blue-200'} border rounded-lg p-4 flex justify-between items-start gap-3 group transition`}
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold text-lg ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                          {entry.entryName}
                        </h3>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {entry.legBandNumbers.map((band, idx) => {
                            const detail = entry.legBandDetails?.find(d => d.legBand === band);
                            const featherType = detail?.featherType || 'Unknown';
                            return (
                              <div key={idx} className={`px-2 py-1 text-xs rounded-lg ${
                                isDarkMode
                                  ? 'bg-blue-900/50 text-blue-200 border border-blue-700'
                                  : 'bg-blue-200 text-blue-800 border border-blue-300'
                              }`}>
                                <div className="font-mono font-bold">#{band}</div>
                                <div className="text-xs opacity-75">{featherType}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleEditEntry(entry)}
                          className={`p-2 rounded-lg transition ${
                            isDarkMode
                              ? 'text-blue-400 hover:bg-blue-900/40 hover:text-blue-300'
                              : 'text-blue-600 hover:bg-blue-200'
                          }`}
                          title="Edit entry"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry._id)}
                          disabled={deleting === entry._id}
                          className={`p-2 rounded-lg transition ${
                            deleting === entry._id
                              ? 'opacity-100 text-gray-500 cursor-not-allowed'
                              : isDarkMode
                              ? 'text-red-400 hover:bg-red-900/40 hover:text-red-300'
                              : 'text-red-600 hover:bg-red-200'
                          }`}
                          title="Delete entry"
                        >
                          {deleting === entry._id ? <Loader size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
