import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { API_URL } from "../utils/apiConfig";

const API = API_URL;

export default function TellerPage() {
  const [denoms, setDenoms] = useState([
    { value: 1000, pcs: 0 },
    { value: 500, pcs: 0 },
    { value: 200, pcs: 0 },
    { value: 100, pcs: 0 },
    { value: 50, pcs: 0 },
  ]);
  const [remarks, setRemarks] = useState("");
  const [cashOnHand, setCashOnHand] = useState(0);
  const [shortOver, setShortOver] = useState(0);
  const [tellerName, setTellerName] = useState("");
  const [status, setStatus] = useState("unsaved");
  const [verified, setVerified] = useState(false);
  const [showPrintButton, setShowPrintButton] = useState(false);

  // 💸 Salary data
  const [salary, setSalary] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  useEffect(() => {
    const total = denoms.reduce(
      (sum, d) => sum + d.value * (parseInt(d.pcs) || 0),
      0
    );
    setCashOnHand(total);
  }, [denoms]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.username) {
      setTellerName(user.username);
      fetchSalary(user.username);
    }
  }, []);

  const fetchSalary = async (name) => {
    try {
      const res = await axios.get(`${API}/api/salaries`);
      const userSalary = res.data.find((s) => s.user === name);
      setSalary(userSalary || null);
    } catch (err) {
      console.error("Error loading salary:", err);
    }
  };

  const handleSubmit = async () => {
    if (!tellerName) return alert("Missing teller name!");

    try {
      const payload = { teller: tellerName, denominations: denoms, cashOnHand, shortOver, remarks };
      await axios.post(`${API}/api/reports/teller`, payload);
      setStatus("saved");
      setShowPrintButton(true);
      alert("✅ Teller report submitted!");
    } catch (err) {
      console.error("Error:", err);
      alert("❌ Failed to save teller report.");
    }
  };

  const handlePrint = async () => {
    try {
      // Check if Web Bluetooth is supported
      if (!navigator.bluetooth) {
        alert("❌ Bluetooth not supported in this browser. Please use Chrome or Edge.");
        return;
      }

      // Request Bluetooth device with printer filters
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          // Common thermal printer service UUIDs
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
          { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] },
          { services: ['00001101-0000-1000-8000-00805f9b34fb'] }, // Serial Port Profile
          // Filter by name containing printer-related keywords
          { namePrefix: 'Printer' },
          { namePrefix: 'Print' },
          { namePrefix: 'Thermal' },
          { namePrefix: 'Receipt' },
          { namePrefix: 'POS' },
          { namePrefix: 'xPrint' },
          { namePrefix: '58IIH' },
          { namePrefix: '80mm' },
          { namePrefix: '58mm' },
        ],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '00001101-0000-1000-8000-00805f9b34fb'
        ]
      });

      // Filter out demo/fake printers
      const deviceName = device.name || 'Unknown Printer';
      const isDemoPrinter = /(demo|test|fake|sample|example)/i.test(deviceName);

      if (isDemoPrinter) {
        alert("❌ Demo/test printer detected. Please select a real thermal printer.");
        return;
      }

      console.log('Connecting to printer:', deviceName, 'Address:', device.id);
      const server = await device.gatt.connect();

      // Try different service UUIDs
      let service;
      const serviceUUIDs = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '00001101-0000-1000-8000-00805f9b34fb'
      ];

      for (const uuid of serviceUUIDs) {
        try {
          service = await server.getPrimaryService(uuid);
          console.log('Found service:', uuid);
          break;
        } catch (e) {
          console.log('Service not found:', uuid);
        }
      }

      if (!service) {
        throw new Error('No compatible printer service found');
      }

      // Get characteristic for writing data
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb') ||
                             await service.getCharacteristic('bef8d6c9-9c21-4c9e-b632-bd58c1009f9f') ||
                             await service.getCharacteristic('00001101-0000-1000-8000-00805f9b34fb');

      // Prepare receipt data
      const receiptData = generateReceiptData();

      // Send data to printer
      await characteristic.writeValue(receiptData);

      alert(`✅ Report printed successfully on ${deviceName}!`);
    } catch (error) {
      console.error('Print error:', error);

      if (error.name === 'NotFoundError') {
        alert("❌ No compatible thermal printer found. Make sure your printer is:\n• Turned on\n• In pairing mode\n• Within Bluetooth range\n• A thermal receipt printer");
      } else if (error.name === 'NotAllowedError') {
        alert("❌ Bluetooth access denied. Please allow Bluetooth access and try again.");
      } else {
        alert("❌ Failed to print: " + error.message);
      }
    }
  };

  const generateReceiptData = () => {
    // ESC/POS commands for thermal printer
    const commands = new Uint8Array([
      0x1B, 0x40, // Initialize printer
      0x1B, 0x61, 0x01, // Center alignment
    ]);

    const encoder = new TextEncoder();
    let data = [];

    // Header
    data.push(...encoder.encode("RMI TELLER REPORT\n"));
    data.push(...encoder.encode("==================\n\n"));

    // Left align for details
    data.push(0x1B, 0x61, 0x00); // Left alignment

    // Teller info
    data.push(...encoder.encode(`Teller: ${tellerName}\n`));
    data.push(...encoder.encode(`Date: ${new Date().toLocaleDateString()}\n`));
    data.push(...encoder.encode(`Time: ${new Date().toLocaleTimeString()}\n\n`));

    // Denominations
    data.push(...encoder.encode("DENOMINATIONS:\n"));
    data.push(...encoder.encode("--------------\n"));
    denoms.forEach(denom => {
      if (denom.pcs > 0) {
        const total = denom.value * denom.pcs;
        data.push(...encoder.encode(`P${denom.value.toString().padStart(4)} x ${denom.pcs.toString().padStart(3)} = P${total.toLocaleString().padStart(8)}\n`));
      }
    });

    data.push(...encoder.encode("--------------\n"));
    data.push(...encoder.encode(`TOTAL CASH: P${cashOnHand.toLocaleString().padStart(8)}\n`));

    if (shortOver !== 0) {
      const sign = shortOver > 0 ? '+' : '';
      data.push(...encoder.encode(`SHORT/OVER: ${sign}P${Math.abs(shortOver).toLocaleString().padStart(7)}\n`));
    }

    if (remarks) {
      data.push(...encoder.encode(`\nREMARKS:\n${remarks}\n`));
    }

    // Footer
    data.push(0x1B, 0x61, 0x01); // Center alignment
    data.push(...encoder.encode("\n==================\n"));
    data.push(...encoder.encode("Thank you for your service!\n"));
    data.push(...encoder.encode("RMI Management\n\n"));

    // Feed and cut paper
    data.push(0x1B, 0x64, 0x03); // Feed 3 lines
    data.push(0x1D, 0x56, 0x42, 0x00); // Full cut

    return new Uint8Array(data);
  };

  const requestWithdraw = async () => {
    if (!withdrawAmount || isNaN(withdrawAmount)) {
      return alert("Please enter a valid amount.");
    }

    try {
      await axios.post(`${API}/api/salaries/withdraw`, {
        user: tellerName,
        amount: Number(withdrawAmount),
      });
      alert("✅ Withdraw request submitted!");
      setWithdrawAmount("");
      fetchSalary(tellerName);
    } catch (err) {
      console.error("Withdraw error:", err);
      alert("❌ Failed to submit withdraw request.");
    }
  };

  return (
    <div className="p-6 bg-gray-100 dark:bg-blue-950 text-gray-900 dark:text-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">💵 Teller Dashboard</h1>

      {/* Teller Info */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <p className="font-semibold text-lg">Welcome, {tellerName}</p>
        <p className="text-sm text-gray-500">Status: {verified ? "Verified" : status}</p>
      </div>

      {/* 💰 Salary Overview */}
      {salary && (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <h2 className="font-semibold text-xl mb-3">💰 Salary Overview</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Card title="Base Salary" value={`₱${salary.baseSalary}`} />
            <Card title="Days Worked" value={salary.daysWorked} />
            <Card title="Total Salary" value={`₱${salary.totalSalary}`} />
          </div>

          <div className="mt-4 text-sm text-gray-400">
            <p>
              Over: ₱{salary.over} | Short: ₱{salary.short} | Late Deduction: ₱{salary.lateDeduction}
            </p>
          </div>

          {/* Withdraw Requests */}
          <div className="mt-6">
            <h3 className="font-semibold mb-2">💸 Withdraw Requests</h3>

            <div className="flex gap-2 mb-3">
              <input
                type="number"
                placeholder="Enter amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                onClick={requestWithdraw}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
              >
                Request
              </button>
            </div>

            {salary.withdrawRequests?.length > 0 ? (
              <table className="w-full text-sm border-collapse">
                <thead className="bg-indigo-600 text-white">
                  <tr>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Requested</th>
                    <th className="p-2">Response</th>
                  </tr>
                </thead>
                <tbody>
                  {salary.withdrawRequests.map((req, idx) => (
                    <tr key={idx} className="border-b dark:border-gray-700">
                      <td className="p-2">₱{req.amount}</td>
                      <td
                        className={`p-2 font-semibold ${
                          req.status === "pending"
                            ? "text-yellow-500"
                            : req.status === "approved"
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {req.status.toUpperCase()}
                      </td>
                      <td className="p-2">{new Date(req.requestedAt).toLocaleString()}</td>
                      <td className="p-2">
                        {req.respondedAt
                          ? new Date(req.respondedAt).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500">No withdrawal requests yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Teller Report Section */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h2 className="font-semibold text-xl mb-3">🧾 Teller Report</h2>
        <table className="w-full border-collapse text-sm mb-6">
          <thead className="bg-indigo-600 text-white">
            <tr>
              <th className="p-3 text-left">Denomination</th>
              <th className="p-3 text-left">Pcs</th>
              <th className="p-3 text-left">Total</th>
            </tr>
          </thead>
          <tbody>
            {denoms.map((d, i) => (
              <tr key={i} className="border-b dark:border-gray-700">
                <td className="p-3">₱{d.value}</td>
                <td className="p-3">
                  <input
                    type="number"
                    value={d.pcs}
                    onChange={(e) => {
                      const updated = [...denoms];
                      updated[i].pcs = parseInt(e.target.value) || 0;
                      setDenoms(updated);
                    }}
                    className="w-24 p-1 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                </td>
                <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">
                  ₱{(d.value * d.pcs).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mb-3 font-semibold">
          Cash On Hand: ₱{cashOnHand.toLocaleString()}
        </div>

        <textarea
          className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 mb-3"
          placeholder="Remarks..."
          rows="3"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
        >
          💾 Save Report
        </button>

        {showPrintButton && (
          <button
            onClick={handlePrint}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md ml-2"
          >
            🖨️ Print Receipt
          </button>
        )}
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow text-center">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{value}</p>
    </div>
  );
}
