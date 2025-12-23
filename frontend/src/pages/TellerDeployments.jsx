import React, { useState, useEffect } from "react";
import { ManualScanFallback } from "../components/ManualScanFallback.jsx";
import axios from "axios";
import { useToast } from "../context/ToastContext.jsx";
import { getApiUrl } from "../utils/apiConfig.js";

export default function TellerDeployments() {
  const [deployments, setDeployments] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanModal, setScanModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const API_URL = getApiUrl();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const deploymentsResponse = await axios.get(`${API_URL}/api/deployments`);
        setDeployments(deploymentsResponse.data.deployments);

        const historyResponse = await axios.get(`${API_URL}/api/assets/all`);
        setScanHistory(historyResponse.data.assets.filter(a => a.scannedBy));
      } catch (error) {
        // Handle error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [API_URL]);

  const handleAcknowledge = async (deploymentId) => {
    // Acknowledge receipt logic
  };

  const handleMarkComplete = async (deploymentId, notes) => {
    // Mark as complete logic
  };

  const handleScanToBorrow = (deployment) => {
    setScanModal(deployment);
  };

  const handleManualSubmit = async (code) => {
    // Manual QR code submit logic
  };

  const isOverdue = (expectedReturnDate, status) => {
    // Overdue check logic
  };

  const getStatusColor = (status) => {
    // Status color logic
  };

  const getPriorityColor = (priority) => {
    // Priority color logic
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">My Deployments</h1>
        <p className="text-gray-600">View and manage your assigned equipment and items</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-600">Total Assigned</h3>
          <p className="text-2xl font-bold text-blue-700">{deployments.length}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <h3 className="text-sm font-medium text-yellow-600">Pending Acknowledgment</h3>
          <p className="text-2xl font-bold text-yellow-700">
            {deployments.filter(d => !d.assignedTellers.find(t => t.tellerId === JSON.parse(localStorage.getItem("user"))?._id)?.acknowledged).length}
          </p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <h3 className="text-sm font-medium text-orange-600">Pending Completion</h3>
          <p className="text-2xl font-bold text-orange-700">
            {deployments.filter(d => !d.tellerCompleteness.find(t => t.tellerId === JSON.parse(localStorage.getItem("user"))?._id)?.isComplete).length}
          </p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <h3 className="text-sm font-medium text-red-600">Overdue</h3>
          <p className="text-2xl font-bold text-red-700">
            {deployments.filter(d => isOverdue(d.expectedReturnDate, d.status)).length}
          </p>
        </div>
      </div>

      {/* Deployments List */}
      <div className="space-y-4">
        {deployments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">No deployments assigned to you</div>
          </div>
        ) : (
          deployments.map((deployment) => {
            const currentUser = JSON.parse(localStorage.getItem("user"));
            const myTellerAssignment = deployment.assignedTellers.find(t => t.tellerId === currentUser?._id);
            const myCompletion = deployment.tellerCompleteness.find(t => t.tellerId === currentUser?._id);
            const assetBorrowed = deployment.assetStatus === 'borrowed';
            return (
              <div
                key={deployment._id}
                className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
                  assetBorrowed ? 'border-green-600 bg-green-50' :
                  isOverdue(deployment.expectedReturnDate, deployment.status) ? 'border-red-500 bg-red-50' :
                  myCompletion?.isComplete ? 'border-green-500' :
                  myTellerAssignment?.acknowledged ? 'border-blue-500' : 'border-yellow-500'
                }`}
              >
                <div className="flex flex-wrap justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{deployment.itemName}</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(deployment.status)}`}>{deployment.status.replace('_', ' ')}</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(deployment.priority)}`}>{deployment.priority} priority</span>
                      {deployment.assetStatus === 'borrowed' && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Borrowed by {deployment.borrowedBy || 'Teller'}</span>
                      )}
                      {isOverdue(deployment.expectedReturnDate, deployment.status) && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">OVERDUE</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      <p><span className="font-medium">Type:</span> {deployment.itemType}</p>
                      <p><span className="font-medium">Quantity:</span> {deployment.quantity}</p>
                      <p><span className="font-medium">Expected Return:</span> {new Date(deployment.expectedReturnDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                {deployment.itemDescription && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">Description:</h4>
                    <p className="text-gray-600 bg-gray-50 p-3 rounded">{deployment.itemDescription}</p>
                  </div>
                )}
                {deployment.notes && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">Notes:</h4>
                    <p className="text-gray-600 bg-gray-50 p-3 rounded">{deployment.notes}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-700">Acknowledgment:</span>
                    {myTellerAssignment?.acknowledged ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Acknowledged on {new Date(myTellerAssignment.acknowledgedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-yellow-600">Pending acknowledgment</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-700">Completion:</span>
                    {myCompletion?.isComplete ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Completed on {new Date(myCompletion.verifiedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-red-600">Not completed</span>
                    )}
                  </div>
                </div>
                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  {!myTellerAssignment?.acknowledged && deployment.status !== 'preparing' && (
                    <button
                      onClick={() => handleAcknowledge(deployment._id)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Acknowledge Receipt
                    </button>
                  )}
                  {myTellerAssignment?.acknowledged && !myCompletion?.isComplete && deployment.status !== 'returned' && (
                    <>
                      <button
                        onClick={() => {
                          const notes = prompt("Add completion notes (optional):");
                          handleMarkComplete(deployment._id, notes || "");
                        }}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Mark as Complete
                      </button>
                      <button
                        onClick={() => handleScanToBorrow(deployment)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-xl font-semibold shadow-md text-lg w-full md:w-auto"
                        style={{ minWidth: 180, marginTop: 8 }}
                      >
                        Scan to Borrow
                      </button>
                    </>
                  )}
                </div>
                {/* Scan Modal - improved design and feedback */}
                {scanModal && scanModal._id === deployment._id && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md mx-2 flex flex-col items-center">
                      <h3 className="text-2xl font-bold mb-2 text-purple-700 text-center">Scan Asset QR to Borrow</h3>
                      <p className="mb-4 text-gray-600 text-center">Scan the QR code on the asset to borrow it. Paste or scan the code below.</p>
                      <div className="w-full mb-4">
                        <ManualScanFallback onSubmit={handleManualSubmit} />
                      </div>
                      {scanning && <div className="mt-4 text-center"><span className="animate-spin inline-block w-8 h-8 border-4 border-purple-300 border-t-transparent rounded-full"></span></div>}
                      {scanSuccess && <div className="mt-4 text-green-600 font-semibold text-center text-lg">{scanSuccess}</div>}
                      {scanError && <div className="mt-4 text-red-600 font-semibold text-center text-lg">{scanError}</div>}
                      <button className="mt-6 px-6 py-3 bg-gray-300 rounded-xl w-full text-lg" onClick={() => setScanModal(null)} disabled={scanning}>Cancel</button>
                    </div>
                  </div>
                )}
                {/* Completion Notes */}
                {myCompletion?.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-gray-700 mb-2">Your Completion Notes:</h4>
                    <p className="text-gray-600 bg-green-50 p-3 rounded">{myCompletion.notes}</p>
                  </div>
                )}
                <div className="mt-2 p-2 bg-gray-100 text-xs rounded">
                  <strong>Debug Info:</strong><br />
                  myTellerAssignment: {JSON.stringify(myTellerAssignment)}<br />
                  myCompletion: {JSON.stringify(myCompletion)}<br />
                  deployment.status: {deployment.status}
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* Recent Scan Events / History */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2 text-gray-700">Recent Scan Events</h2>
        {scanHistory.length === 0 ? (
          <div className="text-gray-400">No recent scan events.</div>
        ) : (
          <div className="space-y-2">
            {scanHistory.slice(-5).reverse().map((asset, idx) => (
              <div key={asset.assetId + idx} className="bg-gray-50 rounded p-2 flex justify-between items-center">
                <span className="font-semibold text-gray-700">{asset.assetType} <span className="text-xs text-gray-500">({asset.assetId})</span></span>
                <span className="text-green-700">Borrowed by: {asset.scannedBy}</span>
                <span className="text-xs text-gray-500">{asset.scannedAt ? new Date(asset.scannedAt).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}