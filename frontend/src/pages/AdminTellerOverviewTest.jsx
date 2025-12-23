import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { getApiUrl } from '../utils/apiConfig';
import { RefreshCw } from 'lucide-react';

export default function AdminTellerOverview() {
  const { settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [tellerData, setTellerData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Test function to see if component loads
  const fetchTellerData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🧪 Testing AdminTellerOverview API call...');
      console.log('API URL:', getApiUrl());
      
      const response = await axios.get(`${getApiUrl()}/api/admin/teller-overview`, {
        params: { date: selectedDate }
      });
      
      console.log('✅ API Response:', response.data);
      setTellerData(response.data.tellers || []);
      showToast({ type: 'success', message: `Loaded ${response.data.tellers?.length || 0} tellers` });
      
    } catch (error) {
      console.error('❌ API Error:', error);
      setError(error.message);
      showToast({ type: 'error', message: 'Failed to load teller data: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🎯 AdminTellerOverview component mounted');
    fetchTellerData();
  }, []);

  return (
    <div className={`p-6 min-h-screen ${dark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Teller Overview</h1>
        
        <div className="mb-6">
          <button
            onClick={fetchTellerData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className={`rounded-lg p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <h2 className="text-xl font-semibold mb-4">Teller Data for {selectedDate}</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Loading teller data...</p>
            </div>
          ) : tellerData.length > 0 ? (
            <div>
              <p className="mb-4 text-green-600 font-medium">✅ Found {tellerData.length} tellers</p>
              <div className="grid gap-4">
                {tellerData.map((teller, index) => (
                  <div key={teller._id || index} className={`p-4 rounded border ${dark ? 'border-gray-600' : 'border-gray-200'}`}>
                    <h3 className="font-medium">{teller.name || 'Unknown'}</h3>
                    <p className="text-sm text-gray-500">@{teller.username || 'No username'}</p>
                    <p className="text-sm">Status: {teller.status || 'Unknown'}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No teller data found for {selectedDate}</p>
              <p className="text-sm text-gray-400 mt-2">Try clicking "Refresh Data" button</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}