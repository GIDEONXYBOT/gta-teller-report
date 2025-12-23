import React, { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import axios from "axios";
import { useToast } from "../context/ToastContext.jsx";
import { getApiUrl } from "../utils/apiConfig.js";
import { ManualScanFallback } from "../components/ManualScanFallback.jsx";

export default function DeclaratorDashboard({ viewOnly = false }) {
  const { showToast } = useToast();
  const API_URL = getApiUrl(); // Get fresh API URL based on current hostname
  const [deployments, setDeployments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [qrMap, setQrMap] = useState({}); // assetId -> dataUrl
  const [assetForm, setAssetForm] = useState({ type: "printer", label: "", serialNumber: "", quantity: 1 });
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanCondition, setScanCondition] = useState("good");
  const [scanNotes, setScanNotes] = useState("");
  const scannerRef = useRef(null);
  const [tellers, setTellers] = useState([]);
  const [selectedDeployments, setSelectedDeployments] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    search: "",
    dateFrom: "",
    dateTo: "",
    overdue: false,
    sortBy: "createdAt",
    sortOrder: "desc"
  });

  // ...existing code...

  // Place this at the end of your component function:
  // return (
  //   <div className="dashboard-root">
  //     <div className="p-6">
  //       {/* Teller dropdown and scan button section */}
  //       <div className="mb-6 flex items-center gap-4">
  //         <label className="block text-sm font-medium text-gray-700">Assign to Teller:</label>
  //         <select
  //           value={selectedTellerId}
  //           onChange={e => setSelectedTellerId(e.target.value)}
  //           className="px-3 py-2 border border-gray-300 rounded-lg"
  //         >
  //           <option value="">Select Teller</option>
  //           {tellers.map(teller => (
  //             <option key={teller._id} value={teller._id}>{teller.name || teller.username}</option>
  //           ))}
  //         </select>
  //         <button
  //           className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
  //           disabled={!selectedTellerId}
  //           onClick={openScan}
  //         >Scan Items</button>
  //       </div>
  //       {/* Breadcrumb Navigation */}
  //       {selectedDeployment && (
  //         <div className="mb-4 flex items-center gap-2 text-sm">
  //           <button 
  //             onClick={() => setSelectedDeployment(null)}
  //             className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
  //           >
  //             ← Back to Deployments
  //           </button>
  //           <span className="text-gray-400">/</span>
  //           <span className="text-gray-700">{selectedDeployment.itemName}</span>
  //         </div>
  //       )}
  //       {/* ...existing code... */}
  //     </div>
  //   </div>
  // )
    if (preset === '2x16') {
      setStickerLayout({ pageSize: 'A4', columns: 2, rows: 16, widthMm: 99, heightMm: 34, gapMm: 2, marginMm: 8, qrSizeMm: 26, fontPt: 10, qrScale: 10, forceOnePage: false });
    } else if (preset === '2x14') {
      setStickerLayout({ pageSize: 'A4', columns: 2, rows: 14, widthMm: 99, heightMm: 38, gapMm: 2, marginMm: 8, qrSizeMm: 28, fontPt: 11, qrScale: 10, forceOnePage: false });
    } else if (preset === '3x8') {
      setStickerLayout({ pageSize: 'A4', columns: 3, rows: 8, widthMm: 70, heightMm: 36, gapMm: 6, marginMm: 6, qrSizeMm: 28, fontPt: 11, qrScale: 10, forceOnePage: false });
    }
  };

  // Form state for creating new deployment
  const [deploymentForm, setDeploymentForm] = useState({
    itemType: "equipment",
    itemName: "",
    itemDescription: "",
    quantity: 1,
    expectedReturnDate: "",
    assignedTellerIds: [],
    priority: "medium",
    notes: ""
  });

  useEffect(() => {
    fetchDashboardData();
    if (!viewOnly) fetchTellers();
    
    // Keyboard shortcuts
    const handleKeyPress = (e) => {
      // ESC to close modals
      if (e.key === 'Escape') {
        if (selectedDeployment) setSelectedDeployment(null);
        if (showCreateModal) setShowCreateModal(false);
        if (showScanModal) setShowScanModal(false);
        if (showStickerLayout) setShowStickerLayout(false);
      }
      // Ctrl/Cmd + N to create new deployment
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !viewOnly) {
        e.preventDefault();
        setShowCreateModal(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [viewOnly, selectedDeployment, showCreateModal, showScanModal, showStickerLayout]);

  useEffect(() => {
    // ...existing code...

  const fetchTellers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });

      const approvedTellers = response.data.filter(
        user => user.role === "teller" && user.status === "approved"
      );
      setTellers(approvedTellers);
    } catch (error) {
      console.error("Error fetching tellers:", error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Build query parameters for the enhanced API
      const params = new URLSearchParams();
      
      // Search functionality
      if (filters.search) {
        params.append('search', filters.search);
      }
      
      // Status filter
      if (filters.status && filters.status !== '') {
        params.append('status', filters.status);
      }
      
      // Priority filter
      if (filters.priority && filters.priority !== '') {
        params.append('priority', filters.priority);
      }
      
      // Date range filters
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo);
      }
      
      // Overdue filter
      if (filters.overdue) {
        params.append('overdue', 'true');
      }
      
      // Sorting
      if (filters.sortBy) {
        params.append('sortBy', filters.sortBy);
        params.append('sortOrder', filters.sortOrder || 'desc');
      }
      
      const queryString = params.toString();
      const url = `${API_URL}/api/deployments${queryString ? `?${queryString}` : ''}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      setDeployments(response.data.deployments || []);
      setStats(response.data.stats || {});
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      showToast({ type: "error", message: "Error loading deployments" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeployment = async (e) => {
    e.preventDefault();
    try {
      // Ensure required fields for backend
      const today = new Date();
      const defaultReturnDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const payload = {
        ...deploymentForm,
        itemType: deploymentForm.itemType || "equipment",
        itemName: deploymentForm.itemName || "Multi-asset",
        expectedReturnDate: deploymentForm.expectedReturnDate || defaultReturnDate,
      };
      await axios.post(`${API_URL}/api/deployments`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });


      showToast({ type: "success", message: "Deployment created successfully" });
      setShowCreateModal(false);
  }

  const fetchAssets = async (deploymentId) => {
    try {
      const today = new Date();
      const params = new URLSearchParams();
      if (filters.history) {
        const toVal = filters.historyTo || today.toISOString().slice(0,10);
        const fromDate = new Date(toVal);
        const fromIso = filters.historyFrom || new Date(fromDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0,10);
        params.append("from", fromIso);
        params.append("to", toVal);
      }
      const q = params.toString() ? `?${params.toString()}` : "";
      const res = await axios.get(`${API_URL}/api/deployments/${deploymentId}/assets${q}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setAssets(res.data.data || []);
    } catch (error) {
      console.error("Error loading assets:", error);
      showToast({ type: "error", message: "Error loading assets" });
    } finally {
      setAssetsLoading(false);
    }
  };

  const addAsset = async (deploymentId) => {
    try {
      if (!assetForm.label) {
        showToast({ type: "warning", message: "Please enter asset label" });
        return;
      }
      const payload = { items: [{ ...assetForm, quantity: Number(assetForm.quantity) || 1 }] };
      await axios.post(`${API_URL}/api/deployments/${deploymentId}/assets`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      showToast({ type: "success", message: "Asset added" });
      setAssetForm({ type: assetForm.type, label: "", serialNumber: "", quantity: 1 });
      fetchAssets(deploymentId);
    } catch (error) {
      console.error("Error adding asset:", error);
      showToast({ type: "error", message: error.response?.data?.message || "Error adding asset" });
    }
  };

  const fetchAssetQR = async (deploymentId, assetId) => {
    try {
      const res = await axios.get(`${API_URL}/api/deployments/${deploymentId}/assets/${assetId}/qr`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const dataUrl = res.data?.data?.qr;
      if (dataUrl) setQrMap(prev => ({ ...prev, [assetId]: dataUrl }));
    } catch (error) {
      console.error("Error generating QR:", error);
      showToast({ type: "error", message: "Error generating QR" });
    }
  };

  const downloadQR = (assetId) => {
    const dataUrl = qrMap[assetId];
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${assetId}-qr.png`;
    a.click();
  };

  // ======== Sticker Printing ========
  const getAssetQrDataUrl = async (deploymentId, assetId, qrScale) => {

// ...existing code...
  // This script is now handled in the component lifecycle
  useEffect(() => {
    window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 300); };
  }, []);

      openPrintWindow(html);
    } catch (e) {
      console.error('Print all stickers failed:', e);
      showToast({ type: 'error', message: 'Print all stickers failed' });
    }
  };

  // ======== QR Scan (Return) ========
  const openScan = () => {
    setScanCondition("good");
    setScanNotes("");
    setShowScanModal(true);
  };

  const closeScan = () => {
    setShowScanModal(false);
    // Clean up scanner
    try {
      // Html5QrcodeScanner auto-cleans on clear() if used with render
      const container = document.getElementById('qr-reader');
      if (container) container.innerHTML = "";
    } catch {}
  };

  useEffect(() => {
    if (!showScanModal) return;
    // Initialize scanner once modal is shown
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 250 });
    scannerRef.current = scanner;

    const onScanSuccess = async (decodedText) => {
      // Stop scanner quickly to avoid duplicate scans
      try { scanner.clear(); } catch {}
      await processScan(decodedText);
    };
    const onScanError = () => {};
    scanner.render(onScanSuccess, onScanError);

    return () => {
      try { scanner.clear(); } catch {}
    };
  }, [showScanModal, scanCondition, scanNotes]);

  const processScan = async (qrData) => {
    try {
      await axios.post(`${API_URL}/api/deployments/assets/scan`, {
        qrData,
        condition: scanCondition,
        damageNotes: scanNotes
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      showToast({ type: "success", message: "Asset return recorded" });
      // Refresh assets and deployments lists
      if (selectedDeployment?._id) await fetchAssets(selectedDeployment._id);
      await fetchDeployments();
    } catch (error) {
      console.error('Scan processing error:', error);
      showToast({ type: "error", message: error.response?.data?.message || "Scan failed" });
    } finally {
      closeScan();
    }
  };

  const resetForm = () => {
    setDeploymentForm({
      itemType: "equipment",
      itemName: "",
      itemDescription: "",
      quantity: 1,
      expectedReturnDate: "",
      assignedTellerIds: [],
      priority: "medium",
      notes: ""
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      preparing: "bg-yellow-100 text-yellow-800",
      deployed: "bg-blue-100 text-blue-800",
      in_use: "bg-green-100 text-green-800",
      pending_return: "bg-orange-100 text-orange-800",
      returned: "bg-gray-100 text-gray-800",
      lost: "bg-red-100 text-red-800",
      damaged: "bg-red-100 text-red-800"
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-green-100 text-green-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800"
    };
    return colors[priority] || "bg-gray-100 text-gray-800";
  };

  const isOverdue = (expectedReturnDate, status) => {
    if (status === 'returned') return false;
    return new Date() > new Date(expectedReturnDate);
  };

  const applyQuickFilter = (filterType) => {
    const newFilters = { ...filters };
    switch (filterType) {
      case 'all':
        newFilters.status = '';
        newFilters.overdue = false;
        break;
      case 'active':
        newFilters.status = 'deployed';
        newFilters.overdue = false;
        break;
      case 'pending':
        newFilters.status = 'preparing';
        newFilters.overdue = false;
        break;
      case 'overdue':
        newFilters.status = '';
        newFilters.overdue = true;
        break;
      case 'returned':
        newFilters.status = 'returned';
        newFilters.overdue = false;
        break;
    }
    setFilters(newFilters);
    // Trigger fetch with new filters
    setTimeout(fetchDashboardData, 0);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedDeployments(deployments.map(d => d._id));
    } else {
      setSelectedDeployments([]);
    }
  };

  const handleSelectDeployment = (deploymentId, checked) => {
    if (checked) {
      setSelectedDeployments([...selectedDeployments, deploymentId]);
    } else {
      setSelectedDeployments(selectedDeployments.filter(id => id !== deploymentId));
    }
  };

  const handleBulkReturn = async () => {
    if (selectedDeployments.length === 0) {
      showToast({ type: "warning", message: "Please select deployments to return" });
      return;
    }

    const condition = prompt("Return condition for all selected deployments (excellent/good/fair/poor/damaged):", "good");
    if (!condition) return;

    try {
      await axios.post(`${API_URL}/api/deployments/bulk-return`, {
        deploymentIds: selectedDeployments,
        returnCondition: condition
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      showToast({ type: "success", message: `Successfully returned ${selectedDeployments.length} deployments` });
      setSelectedDeployments([]);
      fetchDashboardData();
    } catch (error) {
      console.error("Bulk return error:", error);
      showToast({ type: "error", message: "Error performing bulk return" });
    }
  };

  const handleBulkUpdateStatus = async (newStatus) => {
    if (selectedDeployments.length === 0) {
      showToast({ type: "warning", message: "Please select deployments to update" });
      return;
    }

    try {
      await axios.post(`${API_URL}/api/deployments/bulk-update-status`, {
        deploymentIds: selectedDeployments,
        status: newStatus
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      showToast({ type: "success", message: `Successfully updated ${selectedDeployments.length} deployments` });
      setSelectedDeployments([]);
      fetchDashboardData();
    } catch (error) {
      console.error("Bulk status update error:", error);
      showToast({ type: "error", message: "Error updating deployment status" });
    }
  };

  const handleExport = async (format = 'csv') => {
    try {
      const params = new URLSearchParams();
      
      // Apply current filters to export
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.overdue) params.append('overdue', 'true');
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder || 'desc');
      params.append('export', format);

      const response = await axios.get(`${API_URL}/api/deployments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `deployments.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      showToast({ type: "success", message: "Export completed successfully" });
    } catch (error) {
      console.error("Export error:", error);
      showToast({ type: "error", message: "Error exporting data" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Teller selection state
  const [selectedTellerId, setSelectedTellerId] = useState("");

  return (
    <div className="p-6">
      {/* Teller dropdown and scan button section */}
      <div className="mb-6 flex items-center gap-4">
        <label className="block text-sm font-medium text-gray-700">Assign to Teller:</label>
        <select
          value={selectedTellerId}
          onChange={e => setSelectedTellerId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Select Teller</option>
          {tellers.map(teller => (
            <option key={teller._id} value={teller._id}>{teller.name || teller.username}</option>
          ))}
        </select>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={!selectedTellerId}
          onClick={openScan}
        >Scan Items</button>
      </div>
      {/* Breadcrumb Navigation */}
      {selectedDeployment && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <button 
            onClick={() => setSelectedDeployment(null)}
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            ← Back to Deployments
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700">{selectedDeployment.itemName}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Deployment Management</h1>
        <p className="text-gray-600">Manage equipment deployments and track completion status</p>
      </div>

      {/* Search and Filters */}
      {!selectedDeployment && (
        <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search by item name, teller..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="preparing">Preparing</option>
                <option value="deployed">Deployed</option>
                <option value="returned">Returned</option>
              </select>
            </div>
            
            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            
            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="createdAt">Date Created</option>
                <option value="expectedReturnDate">Return Date</option>
                <option value="itemName">Item Name</option>
                <option value="priority">Priority</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Overdue Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="overdue"
                checked={filters.overdue}
                onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="overdue" className="ml-2 block text-sm text-gray-900">
                Show only overdue
              </label>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
            <button
              onClick={() => {
                setFilters({
                  status: "",
                  priority: "",
                  search: "",
                  dateFrom: "",
                  dateTo: "",
                  overdue: false,
                  sortBy: "createdAt",
                  sortOrder: "desc"
                });
                fetchDashboardData();
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Quick Filter Pills - Only show when not viewing deployment detail */}
      {!selectedDeployment && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => applyQuickFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              !filters.status && !filters.overdue
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            📋 All
          </button>
          <button
            onClick={() => applyQuickFilter('active')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filters.status === 'deployed'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            🚀 Active ({stats.totalDeployed || 0})
          </button>
          <button
            onClick={() => applyQuickFilter('pending')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filters.status === 'pending'
                ? 'bg-yellow-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            ⏳ Pending
          </button>
          <button
            onClick={() => applyQuickFilter('overdue')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filters.overdue
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            ⚠️ Overdue ({stats.overdue || 0})
          </button>
          <button
            onClick={() => applyQuickFilter('returned')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filters.status === 'returned'
                ? 'bg-gray-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            ✅ Returned ({stats.totalReturned || 0})
          </button>
          {!viewOnly && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="ml-auto px-4 py-2 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md transition"
            >
              + New (Ctrl+N)
            </button>
          )}
        </div>
      )}

      {/* Quick Filter Pills - Only show when not viewing deployment detail */}
      {!selectedDeployment && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => applyQuickFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              !filters.status && !filters.overdue
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            📋 All
          </button>
          <button
            onClick={() => applyQuickFilter('active')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filters.status === 'deployed'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            🚀 Active ({stats.totalDeployed || 0})
          </button>
          <button
            onClick={() => applyQuickFilter('pending')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filters.status === 'pending'
                ? 'bg-yellow-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            ⏳ Pending
          </button>
          <button
            onClick={() => applyQuickFilter('overdue')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filters.overdue
                ? 'bg-red-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            ⚠️ Overdue ({stats.overdue || 0})
          </button>
          <button
            onClick={() => applyQuickFilter('returned')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filters.status === 'returned'
                ? 'bg-gray-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            ✅ Returned ({stats.totalReturned || 0})
          </button>
          {!viewOnly && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="ml-auto px-4 py-2 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md transition"
            >
              + New Deployment (Ctrl+N)
            </button>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-600">Currently Deployed</h3>
          <p className="text-2xl font-bold text-blue-700">{stats.totalDeployed || 0}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="text-sm font-medium text-green-600">Returned</h3>
          <p className="text-2xl font-bold text-green-700">{stats.totalReturned || 0}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <h3 className="text-sm font-medium text-red-600">Overdue</h3>
          <p className="text-2xl font-bold text-red-700">{stats.overdue || 0}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <h3 className="text-sm font-medium text-orange-600">Pending Completion</h3>
          <p className="text-2xl font-bold text-orange-700">{stats.pendingCompletion || 0}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <h3 className="text-sm font-medium text-purple-600">Urgent</h3>
          <p className="text-2xl font-bold text-purple-700">{stats.urgent || 0}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="preparing">Preparing</option>
            <option value="deployed">Deployed</option>
            <option value="in_use">In Use</option>
            <option value="pending_return">Pending Return</option>
            <option value="returned">Returned</option>
          </select>

          <select
            value={filters.priority}
            onChange={(e) => setFilters({...filters, priority: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.overdue}
              onChange={(e) => setFilters({...filters, overdue: e.target.checked})}
              className="rounded"
            />
            <span className="text-sm">Show Overdue Only</span>
          </label>
        </div>

        {/* Supervisor History Filter */}
        {(viewOnly || user?.role === "supervisor") && (
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-md border border-gray-200">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.historyEnabled}
                onChange={(e) => setFilters({ ...filters, historyEnabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">History</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">From</span>
              <input
                type="date"
                disabled={!filters.historyEnabled}
                value={filters.historyEnabled ? (filters.historyFrom || "") : ""}
                onChange={(e) => setFilters({ ...filters, historyFrom: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded"
              />
              <span className="text-xs text-gray-600">To</span>
              <input
                type="date"
                disabled={!filters.historyEnabled}
                value={filters.historyEnabled ? (filters.historyTo || "") : ""}
                onChange={(e) => setFilters({ ...filters, historyTo: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded"
              />
            </div>
          </div>
        )}

        {/* Create Button */}
        {!viewOnly && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            + Create Deployment
          </button>
        )}
      </div>

      {/* Bulk Actions */}
      {!selectedDeployment && selectedDeployments.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-800">
                {selectedDeployments.length} deployment{selectedDeployments.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkReturn}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                >
                  Bulk Return
                </button>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkUpdateStatus(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                  defaultValue=""
                >
                  <option value="">Update Status</option>
                  <option value="preparing">Set to Preparing</option>
                  <option value="deployed">Set to Deployed</option>
                  <option value="returned">Set to Returned</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => setSelectedDeployments([])}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Export Actions */}
      {!selectedDeployment && (
        <div className="mb-4 flex justify-end gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Export Excel
          </button>
        </div>
      )}

      {/* Deployments Table - Desktop */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectedDeployments.length === deployments.length && deployments.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Tellers</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Return</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {deployments.map((deployment) => (
              <tr key={deployment._id} className={isOverdue(deployment.expectedReturnDate, deployment.status) ? "bg-red-50" : ""}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedDeployments.includes(deployment._id)}
                    onChange={(e) => handleSelectDeployment(deployment._id, e.target.checked)}
                    className="rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{deployment.itemName}</div>
                    <div className="text-sm text-gray-500">{deployment.itemType} • Qty: {deployment.quantity}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(deployment.status)}`}>
                    {deployment.status.replace('_', ' ')}
                  </span>
                  {isOverdue(deployment.expectedReturnDate, deployment.status) && (
                    <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      OVERDUE
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(deployment.priority)}`}>
                    {deployment.priority}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {deployment.assignedTellers.map(teller => (
                      <div key={teller.tellerId} className="flex items-center gap-2">
                        <span>{teller.tellerName}</span>
                        {teller.acknowledged ? (
                          <span className="text-green-600 text-xs">✓ Acknowledged</span>
                        ) : (
                          <span className="text-yellow-600 text-xs">Pending</span>
                        )}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(deployment.expectedReturnDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <div className={`px-2 py-1 rounded text-xs ${deployment.allTellersComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {deployment.allTellersComplete ? 'Complete' : 'Pending'}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      {deployment.tellerCompleteness.filter(t => t.isComplete).length} / {deployment.tellerCompleteness.length}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-y-1">
                  {!viewOnly && deployment.status === 'preparing' && (
                    <button
                      onClick={() => handleMarkAsDeployed(deployment._id)}
                      className="text-blue-600 hover:text-blue-900 block"
                    >
                      Mark Deployed
                    </button>
                  )}
                  {!viewOnly && deployment.status === 'deployed' && deployment.allTellersComplete && (
                    <button
                      onClick={() => {
                        const condition = prompt("Return condition (excellent/good/fair/poor/damaged):", "good");
                        if (condition) {
                          handleMarkAsReturned(deployment._id, { returnCondition: condition });
                        }
                      }}
                      className="text-green-600 hover:text-green-900 block"
                    >
                      Mark Returned
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedDeployment(deployment)}
                    className="text-gray-600 hover:text-gray-900 block"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
            {deployments.length === 0 && !loading && (
              <tr>
                <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                  No deployments found. {!viewOnly && "Click '+ Create Deployment' to add one."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Deployments Cards - Mobile */}
      <div className="md:hidden space-y-4">
        {deployments.map((deployment) => (
          <div key={deployment._id} className={`bg-white rounded-lg shadow p-4 ${isOverdue(deployment.expectedReturnDate, deployment.status) ? "border-2 border-red-300" : ""}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-base font-medium text-gray-900">{deployment.itemName}</div>
                <div className="text-sm text-gray-500">{deployment.itemType} • Qty: {deployment.quantity}</div>
              </div>
              <div className="flex flex-col gap-1">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(deployment.status)}`}>
                  {deployment.status.replace('_', ' ')}
                </span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(deployment.priority)}`}>
                  {deployment.priority}
                </span>
              </div>
            </div>

            {isOverdue(deployment.expectedReturnDate, deployment.status) && (
              <div className="mb-2">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                  OVERDUE
                </span>
              </div>
            )}

            <div className="space-y-2 text-sm mb-3">
              <div>
                <span className="font-medium text-gray-700">Assigned Tellers:</span>
                <div className="mt-1">
                  {deployment.assignedTellers.map(teller => (
                    <div key={teller.tellerId} className="flex items-center gap-2">
                      <span>{teller.tellerName}</span>
                      {teller.acknowledged ? (
                        <span className="text-green-600 text-xs">✓</span>
                      ) : (
                        <span className="text-yellow-600 text-xs">Pending</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Return Date:</span>
                <span className="text-gray-900">{new Date(deployment.expectedReturnDate).toLocaleDateString()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Completion:</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${deployment.allTellersComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {deployment.allTellersComplete ? 'Complete' : 'Pending'}
                  </span>
                  <span className="text-gray-500 text-xs">
                    ({deployment.tellerCompleteness.filter(t => t.isComplete).length}/{deployment.tellerCompleteness.length})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t">
              {!viewOnly && deployment.status === 'preparing' && (
                <button
                  onClick={() => handleMarkAsDeployed(deployment._id)}
                  className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex-1"
                >
                  Mark Deployed
                </button>
              )}
              {!viewOnly && deployment.status === 'deployed' && deployment.allTellersComplete && (
                <button
                  onClick={() => {
                    const condition = prompt("Return condition (excellent/good/fair/poor/damaged):", "good");
                    if (condition) {
                      handleMarkAsReturned(deployment._id, { returnCondition: condition });
                    }
                  }}
                  className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 flex-1"
                >
                  Mark Returned
                </button>
              )}
              <button
                onClick={() => setSelectedDeployment(deployment)}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex-1"
              >
                View Details
              </button>
            </div>
          </div>
        ))}
        {deployments.length === 0 && !loading && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No deployments found. {!viewOnly && "Click '+ Create Deployment' to add one."}
          </div>
        )}
      </div>

      {/* Create Deployment Modal */}
      {!viewOnly && showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create New Deployment</h2>
            <form onSubmit={handleCreateDeployment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Tellers</label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2">
                  {tellers.map((teller) => (
                    <label key={teller._id} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={deploymentForm.assignedTellerIds.includes(teller._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDeploymentForm({
                              ...deploymentForm,
                              assignedTellerIds: [...deploymentForm.assignedTellerIds, teller._id]
                            });
                          } else {
                            setDeploymentForm({
                              ...deploymentForm,
                              assignedTellerIds: deploymentForm.assignedTellerIds.filter(id => id !== teller._id)
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{teller.name || teller.username}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Assets</label>
                <div className="space-y-2">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600">Stand</label>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={!!deploymentForm.stand}
                                          onChange={e => setDeploymentForm({ ...deploymentForm, stand: e.target.checked })}
                                          className="rounded"
                                        />
                                        <span className="text-xs">Stand (check only if included)</span>
                                      </div>
                                    </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Printer</label>
                    <select
                      value={deploymentForm.printer || ""}
                      onChange={e => setDeploymentForm({ ...deploymentForm, printer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select Printer</option>
                      {assets.filter(a => a.type === "printer").map(printer => (
                        <option key={printer.assetId} value={printer.label || printer.assetId}>
                          {printer.label || printer.assetId}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Tablet</label>
                    <input
                      type="text"
                      value={deploymentForm.tablet || ""}
                      onChange={e => setDeploymentForm({ ...deploymentForm, tablet: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Tablet details"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Key</label>
                    <input
                      type="text"
                      value={deploymentForm.key || ""}
                      onChange={e => setDeploymentForm({ ...deploymentForm, key: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Key details"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Charger</label>
                    <input
                      type="text"
                      value={deploymentForm.charger || ""}
                      onChange={e => setDeploymentForm({ ...deploymentForm, charger: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Charger details"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Cash Box</label>
                    <input
                      type="text"
                      value={deploymentForm.cashBox || ""}
                      onChange={e => setDeploymentForm({ ...deploymentForm, cashBox: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Cash box details"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!deploymentForm.paperpin}
                        onChange={e => setDeploymentForm({ ...deploymentForm, paperpin: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-xs">Paperpin (check only if included)</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-600">Remarks</label>
                                <textarea
                                  value={deploymentForm.remarks || ""}
                                  onChange={e => setDeploymentForm({ ...deploymentForm, remarks: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                  rows="2"
                                  placeholder="Additional remarks"
                                />
                              </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  disabled={deploymentForm.assignedTellerIds.length === 0}
                >
                  Create Deployment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deployment Details Modal */}
      {selectedDeployment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Deployment Details</h2>
              <button
                onClick={() => setSelectedDeployment(null)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700">Basic Information</h3>
                  <div className="mt-2 space-y-2 text-sm">
                    <p><span className="font-medium">Item:</span> {selectedDeployment.itemName}</p>
                    <p><span className="font-medium">Type:</span> {selectedDeployment.itemType}</p>
                    <p><span className="font-medium">Quantity:</span> {selectedDeployment.quantity}</p>
                    <p><span className="font-medium">Priority:</span> {selectedDeployment.priority}</p>
                    <p><span className="font-medium">Status:</span> {selectedDeployment.status}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700">Dates</h3>
                  <div className="mt-2 space-y-2 text-sm">
                    <p><span className="font-medium">Created:</span> {new Date(selectedDeployment.createdAt).toLocaleString()}</p>
                    {selectedDeployment.deployedAt && (
                      <p><span className="font-medium">Deployed:</span> {new Date(selectedDeployment.deployedAt).toLocaleString()}</p>
                    )}
                    <p><span className="font-medium">Expected Return:</span> {new Date(selectedDeployment.expectedReturnDate).toLocaleString()}</p>
                    {selectedDeployment.actualReturnDate && (
                      <p><span className="font-medium">Actual Return:</span> {new Date(selectedDeployment.actualReturnDate).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700">Assigned Tellers</h3>
                  <div className="mt-2 space-y-2">
                    {selectedDeployment.assignedTellers.map((teller) => (
                      <div key={teller.tellerId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{teller.tellerName}</span>
                        <span className={`text-xs px-2 py-1 rounded ${teller.acknowledged ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {teller.acknowledged ? 'Acknowledged' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700">Completion Status</h3>
                  <div className="mt-2 space-y-2">
                    {selectedDeployment.tellerCompleteness.map((teller) => (
                      <div key={teller.tellerId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <div className="text-sm">{teller.tellerName}</div>
                          {teller.notes && <div className="text-xs text-gray-500">{teller.notes}</div>}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${teller.isComplete ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {teller.isComplete ? 'Complete' : 'Incomplete'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {selectedDeployment.notes && (
              <div className="mt-6">
                <h3 className="font-medium text-gray-700">Notes</h3>
                <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded">{selectedDeployment.notes}</p>
              </div>
            )}

            {selectedDeployment.itemDescription && (
              <div className="mt-4">
                <h3 className="font-medium text-gray-700">Description</h3>
                <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded">{selectedDeployment.itemDescription}</p>
              </div>
            )}

            {/* Assets Section */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-700">Assets</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchAssets(selectedDeployment._id)}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                  >Refresh</button>
                  {user?.role === 'declarator' && (
                    <button
                      onClick={openScan}
                      className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded"
                    >Scan Return</button>
                  )}
                </div>
              </div>
              {/* Fixed stickers for each asset type */}
              {user?.role === 'admin' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {['printer','tablet','key','charger','cashBox','stand'].map(type => (
                    selectedDeployment[type] ? (
                      <div key={type} className="border rounded p-3 bg-gray-50 flex flex-col items-center">
                        <div className="font-bold mb-1">{type.charAt(0).toUpperCase() + type.slice(1)} Sticker</div>
                        <div className="mb-2 text-xs text-gray-700">{selectedDeployment[type]}</div>
                        {/* QR code placeholder, replace with actual QR code logic if needed */}
                        <div className="mb-2">
                          {/* You can use a QR code library here to generate QR for each asset */}
                          <span className="inline-block bg-gray-200 px-2 py-1 rounded">QR: {selectedDeployment[type]}</span>
                        </div>
                        <button
                          className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                          onClick={() => window.print()}
                        >Print Sticker</button>
                        <button
                          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 mt-2"
                          onClick={() => openAssignModal(type)}
                        >Assign</button>
                      </div>
                    ) : null
                  ))}
                </div>
              )}

              {/* Asset Add Form */}
              {!viewOnly && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
                  {/* ...existing code for asset add form... */}
                </div>
              )}


  // ...existing code...

  return (
    <div className="p-6">
      {/* ...existing code... */}
      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Assign {assignAssetType.charAt(0).toUpperCase() + assignAssetType.slice(1)} to Teller</h2>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Teller</label>
                <select value={assignTellerId} onChange={e => setAssignTellerId(e.target.value)} className="w-full px-3 py-2 border rounded">
                  <option value="">Select Teller</option>
                  {tellers.map(teller => (
                    <option key={teller._id} value={teller._id}>{teller.name || teller.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input type="number" min="1" value={assignQuantity} onChange={e => setAssignQuantity(e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Expected Return Date</label>
                <input type="date" value={assignReturnDate} onChange={e => setAssignReturnDate(e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeAssignModal} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}

              {/* Asset List */}
              <div className="border rounded">
                <div className="p-2 border-b flex items-center justify-between">
                  <div className="text-sm text-gray-600">{assetsLoading ? 'Loading assets...' : `${assets.length} assets`}</div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Label</th>
                        <th className="px-3 py-2 text-left">Serial</th>
                        <th className="px-3 py-2 text-left">Qty</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">QR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {assets.map(asset => (
                        <tr key={asset.assetId}>
                          <td className="px-3 py-2">{asset.type}</td>
                          <td className="px-3 py-2">{asset.label}</td>
                          <td className="px-3 py-2">{asset.serialNumber || '-'}</td>
                          <td className="px-3 py-2">{asset.quantity}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
                              {asset.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {qrMap[asset.assetId] ? (
                              <div className="flex items-center gap-2">
                                <img src={qrMap[asset.assetId]} alt="QR" className="w-14 h-14 border" />
                                {!viewOnly && (
                                  <>
                                    <button onClick={() => downloadQR(asset.assetId)} className="text-blue-600 hover:underline">Download</button>
                                    <span className="text-gray-300">|</span>
                                    <button onClick={() => printStickerForAsset(asset)} className="text-blue-600 hover:underline">Print Sticker</button>
                                  </>
                                )}
                              </div>
                            ) : (
                              viewOnly ? (
                                <span className="text-gray-400">Not available</span>
                              ) : (
                                <button
                                  onClick={() => fetchAssetQR(selectedDeployment._id, asset.assetId)}
                                  className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                                >Get QR</button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                      {assets.length === 0 && !assetsLoading && (
                        <tr>
                          <td colSpan="6" className="px-3 py-6 text-center text-gray-500">No assets yet. Add items above.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Sticker Layout Modal */}
      {!viewOnly && showStickerLayout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-full max-w-lg">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">Sticker Layout (A4)</h2>
              <button onClick={() => setShowStickerLayout(false)} className="text-gray-500 hover:text-gray-700 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <span className="text-sm text-gray-600">Presets:</span>
                <button onClick={() => applyPreset('2x16')} className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">2×16 (99×34mm)</button>
                <button onClick={() => applyPreset('2x14')} className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">2×14 (99×38mm)</button>
                <button onClick={() => applyPreset('3x8')} className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">3×8 (70×36mm)</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">Columns
                  <input type="number" min="1" value={stickerLayout.columns} onChange={(e)=>setStickerLayout({...stickerLayout, columns: Number(e.target.value)||1})} className="mt-1 w-full px-2 py-1 border rounded" />
                </label>
                <label className="text-sm">Rows
                  <input type="number" min="1" value={stickerLayout.rows} onChange={(e)=>setStickerLayout({...stickerLayout, rows: Number(e.target.value)||1})} className="mt-1 w-full px-2 py-1 border rounded" />
                </label>
                <label className="text-sm">Width (mm)
                  <input type="number" min="10" value={stickerLayout.widthMm} onChange={(e)=>setStickerLayout({...stickerLayout, widthMm: Number(e.target.value)||10})} className="mt-1 w-full px-2 py-1 border rounded" />
                </label>
                <label className="text-sm">Height (mm)
                  <input type="number" min="10" value={stickerLayout.heightMm} onChange={(e)=>setStickerLayout({...stickerLayout, heightMm: Number(e.target.value)||10})} className="mt-1 w-full px-2 py-1 border rounded" />
                </label>
                <label className="text-sm">Gap (mm)
                  <input type="number" min="0" value={stickerLayout.gapMm} onChange={(e)=>setStickerLayout({...stickerLayout, gapMm: Number(e.target.value)||0})} className="mt-1 w-full px-2 py-1 border rounded" />
                </label>
                <label className="text-sm">Margin (mm)
                  <input type="number" min="0" value={stickerLayout.marginMm} onChange={(e)=>setStickerLayout({...stickerLayout, marginMm: Number(e.target.value)||0})} className="mt-1 w-full px-2 py-1 border rounded" />
                </label>
                <label className="text-sm">QR Size (mm)
                  <input type="number" min="10" value={stickerLayout.qrSizeMm} onChange={(e)=>setStickerLayout({...stickerLayout, qrSizeMm: Number(e.target.value)||10})} className="mt-1 w-full px-2 py-1 border rounded" />
                </label>
                <label className="text-sm">Font (pt)
                  <input type="number" min="8" value={stickerLayout.fontPt} onChange={(e)=>setStickerLayout({...stickerLayout, fontPt: Number(e.target.value)||8})} className="mt-1 w-full px-2 py-1 border rounded" />
                </label>
                <label className="text-sm">QR Quality (scale 4–12)
                  <input type="number" min="4" max="12" value={stickerLayout.qrScale} onChange={(e)=>setStickerLayout({...stickerLayout, qrScale: Math.min(12, Math.max(4, Number(e.target.value)||10))})} className="mt-1 w-full px-2 py-1 border rounded" />
                </label>
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={stickerLayout.forceOnePage} onChange={(e)=>setStickerLayout({...stickerLayout, forceOnePage: e.target.checked})} className="rounded" />
                  <span>Force 1 page</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={()=>setShowStickerLayout(false)} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Close</button>
                <button onClick={()=>{ setShowStickerLayout(false); printAllStickers(); }} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">Print With Layout</button>
              </div>
            </div>
          </div>
        </div>
      )}

    {/* QR Scan Modal */}
    {!viewOnly && showScanModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
          {/* ...existing code for scan modal... */}
        </div>
      </div>
    )}
    {/* End main dashboard container */}
  </div>
);
}












