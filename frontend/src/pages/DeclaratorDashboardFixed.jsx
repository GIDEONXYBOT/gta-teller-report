import React, { useState, useEffect } from "react";
import { ManualScanFallback } from "../components/ManualScanFallback.jsx";
import QRCode from "react-qr-code";

const assetTypes = [
  "Printer",
  "Tablet",
  "Key",
  "Charger",
  "Cash Box",
  "Stand"
];
function QRSticker({ assetType, assetId }) {
  const qrValue = JSON.stringify({ type: assetType, id: assetId });
  return (
    <div style={{ border: "1px solid #ccc", padding: 12, margin: 8, display: "inline-block", width: 160, textAlign: "center", background: "white" }}>
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>{assetType}</div>
      <QRCode value={qrValue} size={96} />
      <div style={{ fontSize: 12, marginTop: 4 }}>ID: {assetId}</div>
    </div>
  );
}

function AssetItem({ type, status, onScan, onAssign }) {
  return (
    <div className="flex items-center gap-4 p-2 border-b">
      <span className="font-semibold w-32">{type}</span>
      <span className={`px-2 py-1 rounded ${status === 'deployed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{status}</span>
      <button
        className="ml-auto px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={onScan}
      >Scan</button>
      <button
        className="ml-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
        onClick={onAssign}
      >Assign</button>
    </div>
  );
}

export default function DeclaratorDashboard({ viewOnly = false }) {
  const [assets, setAssets] = useState([]);
  const [scanModal, setScanModal] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [assetQuantities, setAssetQuantities] = useState(
    assetTypes.reduce((acc, type) => { acc[type] = 1; return acc; }, {})
  );
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [tellers, setTellers] = useState([]);
  const [selectedTeller, setSelectedTeller] = useState("");
  const [assignQuantity, setAssignQuantity] = useState(1);
  const [assignDate, setAssignDate] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    // Fetch all assets from backend on mount
    setFetching(true);
    fetch('/api/assets/all')
      .then(res => res.json())
      .then(data => {
        if (data.success) setAssets(data.assets);
      })
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    // Fetch tellers for dropdown
    fetch('/api/tellers/all')
      .then(res => res.json())
      .then(data => {
        if (data.success) setTellers(data.tellers);
      });
  }, []);

  const handleScan = idx => {
    setScanModal(idx);
  };
  const handleManualSubmit = text => {
    // Simulate scan success and update backend
    const asset = assets[scanModal];
    fetch('/api/assets/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset.assetId, scannedBy: 'teller' }) // Replace with actual teller info
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAssets(prev => prev.map((a, i) => i === scanModal ? data.asset : a));
        }
      });
    setScanModal(null);
  };

  const handleQuantityChange = (type, value) => {
    setAssetQuantities(q => ({ ...q, [type]: Math.max(1, Number(value) || 1) }));
  };

  const handleSaveToBackend = () => {
    setSaving(true);
    // Prepare asset data for backend
    const assetsToSave = assetTypes.flatMap(type => (
      Array.from({ length: assetQuantities[type] }, (_, i) => ({
        assetType: type,
        assetId: `${type}-${i+1}`,
        qrData: JSON.stringify({ type, id: `${type}-${i+1}` })
      }))
    ));
    fetch('/api/assets/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets: assetsToSave })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAssets(data.assets);
          setShowQRModal(false);
        }
      })
      .finally(() => setSaving(false));
  };

  const handleAssignSubmit = async () => {
    setAssigning(true);
    const asset = assets[assignModal];
    await fetch('/api/deployments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemName: asset.assetType,
        itemType: asset.assetType,
        quantity: assignQuantity,
        expectedReturnDate: assignDate,
        assignedTellers: [{ tellerId: selectedTeller, acknowledged: false }],
        assetId: asset.assetId
      })
    });
    setAssigning(false);
    setAssignModal(null);
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Deployment Management</h2>
      <button
        className="mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        onClick={() => setShowQRModal(true)}
      >Generate QR Stickers</button>

      <div className="bg-white rounded shadow p-4">
        {fetching ? (
          <div className="text-center text-gray-500">Loading assets...</div>
        ) : assets.length === 0 ? (
          <div className="text-center text-gray-500">No assets found. Generate and save QR stickers.</div>
        ) : (
          assets.map((asset, idx) => (
            <AssetItem
              key={asset.assetId}
              type={asset.assetType}
              status={asset.status}
              onScan={() => handleScan(idx)}
              onAssign={() => setAssignModal(idx)}
            />
          ))
        )}
      </div>

      {scanModal !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-2">Scan {assets[scanModal].type}</h3>
            <ManualScanFallback onSubmit={handleManualSubmit} />
            <button className="mt-4 px-3 py-1 bg-gray-300 rounded" onClick={() => setScanModal(null)}>Cancel</button>
          </div>
        </div>
      )}

      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-[600px] max-h-[80vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-2">Generate QR Stickers</h3>
            <div className="mb-4">
              {assetTypes.map(type => (
                <div key={type} className="flex items-center gap-2 mb-2">
                  <span className="w-32 font-semibold">{type}</span>
                  <input
                    type="number"
                    min={1}
                    value={assetQuantities[type]}
                    onChange={e => handleQuantityChange(type, e.target.value)}
                    className="w-16 px-2 py-1 border rounded"
                  />
                  <span className="text-xs text-gray-500">Quantity</span>
                </div>
              ))}
            </div>
            <div id="qr-sticker-print-area" className="flex flex-wrap gap-2 justify-center">
              {assetTypes.flatMap(type => (
                Array.from({ length: assetQuantities[type] }, (_, i) => (
                  <QRSticker key={type + '-' + (i+1)} assetType={type} assetId={type + '-' + (i+1)} />
                ))
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => {
                  const printContents = document.getElementById('qr-sticker-print-area').innerHTML;
                  const printWindow = window.open('', '', 'height=600,width=800');
                  printWindow.document.write('<html><head><title>Print QR Stickers</title>');
                  printWindow.document.write('<style>body{background:white;} div{display:inline-block;margin:8px;}</style>');
                  printWindow.document.write('</head><body >');
                  printWindow.document.write(printContents);
                  printWindow.document.write('</body></html>');
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
                }}
              >Print Stickers</button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                disabled={saving}
                onClick={handleSaveToBackend}
              >{saving ? 'Saving...' : 'Save to System'}</button>
              <button className="px-4 py-2 bg-gray-300 rounded" onClick={() => setShowQRModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {assignModal !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-2">Assign {assets[assignModal].type}</h3>
            <div className="mb-3">
              <label className="block mb-1 font-medium">Select Teller</label>
              <select
                className="w-full px-2 py-1 border rounded"
                value={selectedTeller}
                onChange={e => setSelectedTeller(e.target.value)}
              >
                <option value="">-- Select Teller --</option>
                {tellers.map(t => (
                  <option key={t._id} value={t._id}>{t.name || t.username}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block mb-1 font-medium">Quantity</label>
              <input
                type="number"
                min={1}
                value={assignQuantity}
                onChange={e => setAssignQuantity(Number(e.target.value))}
                className="w-full px-2 py-1 border rounded"
              />
            </div>
            <div className="mb-3">
              <label className="block mb-1 font-medium">Expected Return Date</label>
              <input
                type="date"
                value={assignDate}
                onChange={e => setAssignDate(e.target.value)}
                className="w-full px-2 py-1 border rounded"
              />
            </div>
            <button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              disabled={assigning || !selectedTeller || !assignDate}
              onClick={handleAssignSubmit}
            >{assigning ? 'Assigning...' : 'Assign'}</button>
            <button className="mt-4 px-3 py-1 bg-gray-300 rounded" onClick={() => setAssignModal(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
