import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { SettingsContext } from "../context/SettingsContext";
import { useToast } from "../context/ToastContext";
import { getApiUrl } from "../utils/apiConfig";
import {
  MapPin,
  Users,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  BarChart3,
  TrendingUp,
  RefreshCw,
} from "lucide-react";

const AdvancedTellerAssignment = () => {
  const { isDarkMode } = useContext(SettingsContext);
  const { addToast } = useToast();
  const API = getApiUrl();

  const [zones, setZones] = useState([]);
  const [tellers, setTellers] = useState([]);
  const [bettingData, setBettingData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [showAssignTeller, setShowAssignTeller] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  const [newZone, setNewZone] = useState({
    name: "",
    description: "",
    region: "",
  });

  const [assignData, setAssignData] = useState({
    tellerId: "",
    zoneId: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch zones
      const zonesRes = await axios.get(`${API}/api/teller-zones/list`, { headers });
      if (zonesRes.data.success) {
        setZones(zonesRes.data.data);
      }

      // Fetch tellers
      const tellersRes = await axios.get(`${API}/api/users/tellers`, { headers });
      if (tellersRes.data.success) {
        setTellers(tellersRes.data.data);
      }

      // Fetch betting data for performance metrics
      const bettingRes = await axios.get(`${API}/api/betting-data/list`, { headers });
      if (bettingRes.data.success) {
        setBettingData(bettingRes.data.data);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to fetch data";
      addToast(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddZone = async () => {
    if (!newZone.name.trim() || !newZone.region.trim()) {
      addToast("Zone name and region are required", "error");
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const response = await axios.post(
        `${API}/api/teller-zones/create`,
        newZone,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setZones([...zones, response.data.data]);
        setNewZone({ name: "", description: "", region: "" });
        setShowAddZone(false);
        addToast("Zone created successfully", "success");
      }
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to create zone", "error");
    }
  };

  const handleDeleteZone = async (zoneId) => {
    if (!window.confirm("Are you sure you want to delete this zone?")) return;

    try {
      const token = localStorage.getItem("authToken");
      const response = await axios.delete(
        `${API}/api/teller-zones/${zoneId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setZones(zones.filter((z) => z._id !== zoneId));
        addToast("Zone deleted successfully", "success");
      }
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to delete zone", "error");
    }
  };

  const handleAssignTeller = async () => {
    if (!assignData.tellerId || !assignData.zoneId) {
      addToast("Please select both teller and zone", "error");
      return;
    }

    try {
      const token = localStorage.getItem("authToken");
      const response = await axios.post(
        `${API}/api/teller-zones/assign`,
        assignData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Update zones with new assignment
        const updatedZones = zones.map((z) =>
          z._id === assignData.zoneId
            ? { ...z, assignedTellers: [...(z.assignedTellers || []), assignData.tellerId] }
            : z
        );
        setZones(updatedZones);
        setAssignData({ tellerId: "", zoneId: "" });
        setShowAssignTeller(false);
        addToast("Teller assigned successfully", "success");
      }
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to assign teller", "error");
    }
  };

  const getZonePerformance = (zone) => {
    if (!zone.assignedTellers || zone.assignedTellers.length === 0) {
      return { totalBets: 0, avgMWBet: 0, tellerCount: 0 };
    }

    const zoneData = bettingData.filter((d) =>
      zone.assignedTellers.includes(d.username)
    );

    const totalBets = zoneData.reduce((sum, d) => sum + (d.totalBet || 0), 0);
    const avgMWBet = zoneData.length > 0
      ? (zoneData.reduce((sum, d) => sum + (d.mwBetPercent || 0), 0) / zoneData.length).toFixed(2)
      : 0;

    return {
      totalBets,
      avgMWBet,
      tellerCount: zone.assignedTellers.length,
    };
  };

  const ZoneCard = ({ zone }) => {
    const performance = getZonePerformance(zone);

    return (
      <div
        className={`p-6 rounded-lg border ${
          isDarkMode
            ? "bg-gray-800 border-gray-700 hover:border-blue-500"
            : "bg-white border-gray-200 hover:border-blue-500"
        } transition-colors`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500 bg-opacity-20">
              <MapPin size={20} className="text-blue-500" />
            </div>
            <div>
              <h3 className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                {zone.name}
              </h3>
              <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                {zone.region}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDeleteZone(zone._id)}
            className="p-2 rounded-lg hover:bg-red-500 hover:bg-opacity-20 text-red-500"
            title="Delete zone"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {zone.description && (
          <p className={`text-sm mb-4 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
            {zone.description}
          </p>
        )}

        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-gray-700">
          <div className="text-center">
            <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
              Total Bets
            </p>
            <p className="font-bold text-green-500">
              ₱{performance.totalBets.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
              Avg M/W %
            </p>
            <p className="font-bold text-blue-500">{performance.avgMWBet}%</p>
          </div>
          <div className="text-center">
            <p className={`text-xs ${isDarkMode ? "text-gray-500" : "text-gray-500"}`}>
              Tellers
            </p>
            <p className="font-bold text-purple-500">{performance.tellerCount}</p>
          </div>
        </div>

        {/* Assigned Tellers */}
        {zone.assignedTellers && zone.assignedTellers.length > 0 && (
          <div>
            <p className={`text-sm font-semibold mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Assigned Tellers:
            </p>
            <div className="flex flex-wrap gap-2">
              {zone.assignedTellers.map((teller, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full text-sm bg-blue-500 bg-opacity-20 text-blue-500"
                >
                  {teller}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-screen p-8 ${isDarkMode ? "bg-gray-900" : "bg-gray-50"}`}>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            Advanced Teller Assignment
          </h1>
          <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            Manage zones and assign tellers for regional performance tracking
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddZone(true)}
            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
          >
            <Plus size={18} />
            Add Zone
          </button>
          <button
            onClick={() => setShowAssignTeller(true)}
            className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center gap-2"
          >
            <Users size={18} />
            Assign Teller
          </button>
        </div>
      </div>

      {/* Add Zone Modal */}
      {showAddZone && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-full max-w-md ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Create New Zone
              </h2>
              <button
                onClick={() => setShowAddZone(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Zone Name *
                </label>
                <input
                  type="text"
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                  placeholder="e.g., Metro Manila North"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Region *
                </label>
                <input
                  type="text"
                  value={newZone.region}
                  onChange={(e) => setNewZone({ ...newZone, region: e.target.value })}
                  placeholder="e.g., Luzon"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Description
                </label>
                <textarea
                  value={newZone.description}
                  onChange={(e) => setNewZone({ ...newZone, description: e.target.value })}
                  placeholder="Additional details about this zone"
                  rows="3"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300"
                  }`}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddZone}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Create Zone
                </button>
                <button
                  onClick={() => setShowAddZone(false)}
                  className={`flex-1 px-4 py-2 rounded-lg border ${
                    isDarkMode
                      ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Teller Modal */}
      {showAssignTeller && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`p-6 rounded-lg w-full max-w-md ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Assign Teller to Zone
              </h2>
              <button
                onClick={() => setShowAssignTeller(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Select Teller *
                </label>
                <select
                  value={assignData.tellerId}
                  onChange={(e) => setAssignData({ ...assignData, tellerId: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300"
                  }`}
                >
                  <option value="">Choose a teller...</option>
                  {tellers.map((teller) => (
                    <option key={teller._id} value={teller._id}>
                      {teller.username} ({teller.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                  Select Zone *
                </label>
                <select
                  value={assignData.zoneId}
                  onChange={(e) => setAssignData({ ...assignData, zoneId: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-white border-gray-300"
                  }`}
                >
                  <option value="">Choose a zone...</option>
                  {zones.map((zone) => (
                    <option key={zone._id} value={zone._id}>
                      {zone.name} ({zone.region})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAssignTeller}
                  className="flex-1 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Assign
                </button>
                <button
                  onClick={() => setShowAssignTeller(false)}
                  className={`flex-1 px-4 py-2 rounded-lg border ${
                    isDarkMode
                      ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zones Grid */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw size={32} className="mx-auto text-blue-500 animate-spin mb-4" />
          <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            Loading zones and teller data...
          </p>
        </div>
      ) : zones.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zones.map((zone) => (
            <ZoneCard key={zone._id} zone={zone} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <MapPin size={48} className="mx-auto text-gray-400 mb-4" />
          <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
            No zones created yet. Click "Add Zone" to get started!
          </p>
        </div>
      )}
    </div>
  );
};

export default AdvancedTellerAssignment;
