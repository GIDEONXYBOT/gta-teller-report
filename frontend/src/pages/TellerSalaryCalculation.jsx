import React, { Fragment, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SettingsContext } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { getApiUrl } from '../utils/apiConfig';
import { Loader2, ChevronLeft, ChevronRight, Calendar, Printer, HardDrive, Settings2, CheckSquare, Square, Copy } from 'lucide-react';

export default function TellerSalaryCalculation() {
  const { user, settings } = useContext(SettingsContext);
  const { showToast } = useToast();
  const dark = settings?.theme?.mode === 'dark';

  const [tellers, setTellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date().toISOString().split('T')[0]);
  const [weekStart, setWeekStart] = useState(null);
  const [weekEnd, setWeekEnd] = useState(null);
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(
    localStorage.getItem('autoPrintEnabled') === 'true'
  );
  const [noBSalarDays, setNoBSalaryDays] = useState(() => {
    const saved = localStorage.getItem('noBSalarDays');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedTellers, setSelectedTellers] = useState({});
  const dayLabels = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
    { key: 'sat', label: 'Sat' },
    { key: 'sun', label: 'Sun' }
  ];
  const baseSalaryAmount = 450;
  const baseWeeklySum = baseSalaryAmount * dayLabels.length;
  const sumOver = (overObj = {}) =>
    dayLabels.reduce((sum, { key }) => sum + (overObj[key] || 0), 0);
  const formatCurrency = (value) => `₱${value.toFixed(2)}`;
  const getWeekRangeLabel = () => {
    if (weekStart && weekEnd) {
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return 'Week overview';
  };

  // Toggle base salary for a specific teller/day
  const toggleBaseSalaryDay = (tellerId, dayKey) => {
    const key = `${tellerId}-${dayKey}`;
    setNoBSalaryDays(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Toggle teller selection for batch printing
  const toggleTellerSelection = (tellerId) => {
    setSelectedTellers(prev => ({
      ...prev,
      [tellerId]: !prev[tellerId]
    }));
  };

  // Select/Deselect all tellers
  const toggleSelectAll = () => {
    const allSelected = tellers.length > 0 && Object.keys(selectedTellers).length === tellers.length;
    if (allSelected) {
      setSelectedTellers({});
    } else {
      const newSelection = {};
      tellers.forEach(t => {
        newSelection[t.id] = true;
      });
      setSelectedTellers(newSelection);
    }
  };

  const buildPrintHtml = (teller, dailyOver) => {
    const weekLabel = getWeekRangeLabel();
    
    // Calculate base salary considering excluded days
    let totalBaseSalary = 0;
    const printableRows = dayLabels
      .map(({ key, label }) => {
        const overAmount = dailyOver[key] || 0;
        const noBSalaryKey = `${teller.id}-${key}`;
        const isIncluded = noBSalarDays[noBSalaryKey];
        const baseSalaryForDay = isIncluded ? baseSalaryAmount : 0;
        totalBaseSalary += baseSalaryForDay;
        return `<div class="row">
  <span class="col-day">${label}</span>
  <span class="col-over">${formatCurrency(overAmount)}</span>
  <span class="col-base">${formatCurrency(baseSalaryForDay)}</span>
</div>`;
      })
      .join('');

    const totalOver = sumOver(dailyOver);
    const totalCompensationPrint = totalBaseSalary + totalOver;

    const html = `<!doctype html>
<html>
<head>
  <title>${teller.name} - Teller Report</title>
  <style>
    @media print {
      @page { size: 58mm auto; margin: 4mm; }
    }
    * { box-sizing: border-box; }
    body { 
      font-family: 'Courier New', monospace; 
      padding: 8px; 
      margin: 0; 
      width: 220px; 
      font-size: 11px;
      line-height: 1.3;
    }
    h2 { 
      margin: 0 0 2px; 
      font-size: 14px; 
      font-weight: bold;
      text-align: center;
    }
    p { 
      margin: 1px 0; 
      font-size: 10px; 
      text-align: center;
    }
    .row { 
      display: flex; 
      justify-content: space-between; 
      margin: 2px 0; 
      font-size: 11px;
      font-family: 'Courier New', monospace;
    }
    .col-day { flex: 0 0 30px; }
    .col-over { flex: 1; text-align: right; padding-right: 8px; }
    .col-base { flex: 0 0 60px; text-align: right; }
    .divider { 
      border-top: 1px solid #000; 
      margin: 4px 0; 
    }
    .section-divider {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .signature { 
      margin-top: 12px; 
      font-size: 9px; 
    }
    .signature-line { 
      border-top: 1px solid #000; 
      margin-top: 8px; 
      padding-top: 2px;
      height: 20px;
    }
    .total-row {
      font-weight: bold;
      border-top: 1px solid #000;
      padding-top: 2px;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <h2>${teller.name}</h2>
  <p>ID: ${teller.id}</p>
  <p>${weekLabel}</p>
  <div class="section-divider"></div>
  <div style="font-size: 10px; display: flex; justify-content: space-between; margin-bottom: 2px;">
    <span style="flex: 0 0 30px;">Day</span>
    <span style="flex: 1; text-align: right; padding-right: 8px;">Over</span>
    <span style="flex: 0 0 60px; text-align: right;">Base</span>
  </div>
  ${printableRows}
  <div class="divider"></div>
  <div class="row">
    <span class="col-day" style="font-weight: bold;">OVER:</span>
    <span class="col-over"></span>
    <span class="col-base" style="font-weight: bold;">${formatCurrency(totalOver)}</span>
  </div>
  <div class="row">
    <span class="col-day" style="font-weight: bold;">BASE:</span>
    <span class="col-over"></span>
    <span class="col-base" style="font-weight: bold;">${formatCurrency(totalBaseSalary)}</span>
  </div>
  <div class="row total-row">
    <span class="col-day" style="font-weight: bold;">TOTAL:</span>
    <span class="col-over"></span>
    <span class="col-base" style="font-weight: bold;">${formatCurrency(totalCompensationPrint)}</span>
  </div>
  <div class="signature">
    <p>Prepared by: _________________________</p>
    <div class="signature-line"></div>
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    return html;
  };

  const previewPrintInBrowser = (html) => {
    const printWindow = window.open('', '_blank', 'width=340,height=640');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const copyReportToClipboard = (teller) => {
    const dailyOver = teller.over || {};
    const weekLabel = getWeekRangeLabel();
    
    // Calculate base salary considering excluded days
    let totalBaseSalary = 0;
    const reportLines = [
      `RMI TELLER REPORT`,
      `==================`,
      `Teller: ${teller.name}`,
      `ID: ${teller.id}`,
      `Period: ${weekLabel}`,
      ``,
      `Day         Over Amount      Base Salary`,
      `---         -----------      -----------`
    ];
    
    dayLabels.forEach(({ key, label }) => {
      const overAmount = dailyOver[key] || 0;
      const noBSalaryKey = `${teller.id}-${key}`;
      const isIncluded = noBSalarDays[noBSalaryKey];
      const baseSalaryForDay = isIncluded ? baseSalaryAmount : 0;
      totalBaseSalary += baseSalaryForDay;
      
      const dayLine = `${label.padEnd(11)}${formatCurrency(overAmount).padStart(15)}${formatCurrency(baseSalaryForDay).padStart(16)}`;
      reportLines.push(dayLine);
    });
    
    const totalOver = sumOver(dailyOver);
    const totalCompensationPrint = totalBaseSalary + totalOver;
    
    reportLines.push(`---         -----------      -----------`);
    reportLines.push(`OVER Total${formatCurrency(totalOver).padStart(30)}`);
    reportLines.push(`BASE Total${formatCurrency(totalBaseSalary).padStart(30)}`);
    reportLines.push(`TOTAL COMP${formatCurrency(totalCompensationPrint).padStart(30)}`);
    
    const reportText = reportLines.join('\n');
    navigator.clipboard.writeText(reportText).then(() => {
      showToast({ type: 'success', message: 'Report copied to clipboard!' });
    }).catch(() => {
      showToast({ type: 'error', message: 'Failed to copy report' });
    });
  };

  const handlePrint = (teller) => {
    const dailyOver = teller.over || {};
    const html = buildPrintHtml(teller, dailyOver);
    if (window?.electronAPI?.printHTML) {
      window.electronAPI.printHTML(html, selectedPrinter);
      showToast({ type: 'success', message: `Printing to ${selectedPrinter?.name || 'default printer'}...` });
      return;
    }
    previewPrintInBrowser(html);
  };

  // Build A4 batch print HTML for 6 cards per page
  const buildA4BatchPrintHtml = () => {
    const selectedTellersList = tellers.filter(t => selectedTellers[t.id]);
    if (selectedTellersList.length === 0) {
      showToast({ type: 'error', message: 'Please select at least one teller to print' });
      return null;
    }

    const weekLabel = getWeekRangeLabel();
    
    const cardHtml = selectedTellersList.map(teller => {
      const dailyOver = teller.over || {};
      let totalBaseSalary = 0;
      const rowsHtml = dayLabels
        .map(({ key, label }) => {
          const overAmount = dailyOver[key] || 0;
          const noBSalaryKey = `${teller.id}-${key}`;
          const isIncluded = noBSalarDays[noBSalaryKey];
          const baseSalaryForDay = isIncluded ? baseSalaryAmount : 0;
          totalBaseSalary += baseSalaryForDay;
          return `<tr><td>${label}</td><td>₱${overAmount.toFixed(2)}</td><td>₱${baseSalaryForDay.toFixed(2)}</td></tr>`;
        })
        .join('');
      
      const totalOver = sumOver(dailyOver);
      const totalComp = totalBaseSalary + totalOver;

      return `
        <div class="card">
          <div class="card-header">
            <h4>${teller.name}</h4>
            <p>ID: ${teller.id}</p>
          </div>
          <div class="card-body">
            <table class="daily-table">
              <thead>
                <tr><th>Day</th><th>Over</th><th>Base</th></tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <div class="totals">
              <div class="total-row"><span>Over Total:</span> <strong>₱${totalOver.toFixed(2)}</strong></div>
              <div class="total-row"><span>Base Total:</span> <strong>₱${totalBaseSalary.toFixed(2)}</strong></div>
              <div class="total-comp"><span>TOTAL:</span> <strong>₱${totalComp.toFixed(2)}</strong></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Teller Reports - ${weekLabel}</title>
  <style>
    @media print {
      @page { size: A4; margin: 0.5cm; }
      body { margin: 0; padding: 0.5cm; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      padding: 10px;
    }
    .page-title {
      text-align: center;
      margin-bottom: 15px;
      font-size: 14px;
      font-weight: bold;
      padding: 10px;
      border-bottom: 2px solid #333;
    }
    .cards-container {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      page-break-inside: avoid;
    }
    .card {
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      padding: 10px;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .card-header {
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 5px;
      margin-bottom: 8px;
    }
    .card-header h4 {
      font-size: 13px;
      margin: 0;
      color: #1f2937;
    }
    .card-header p {
      font-size: 10px;
      color: #6b7280;
      margin: 2px 0 0 0;
    }
    .card-body {
      font-size: 10px;
    }
    .daily-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .daily-table th, .daily-table td {
      border: 1px solid #e5e7eb;
      padding: 3px;
      text-align: right;
      font-size: 9px;
    }
    .daily-table th {
      background: #f3f4f6;
      font-weight: 600;
      text-align: center;
    }
    .daily-table td:first-child, .daily-table th:first-child {
      text-align: left;
    }
    .totals {
      border-top: 1px solid #e5e7eb;
      padding-top: 5px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      margin-bottom: 3px;
    }
    .total-comp {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: bold;
      padding-top: 3px;
      border-top: 1px solid #d1d5db;
      margin-top: 3px;
      color: #4f46e5;
    }
    @media print {
      .cards-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .card { padding: 8px; }
      body { background: white; }
    }
  </style>
</head>
<body>
  <div class="page-title">Teller Salary Calculation - ${weekLabel}</div>
  <div class="cards-container">
    ${cardHtml}
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    return html;
  };

  const handleBatchPrint = () => {
    const html = buildA4BatchPrintHtml();
    if (!html) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast({ type: 'error', message: 'Failed to open print window' });
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const fetchAvailablePrinters = async () => {
    if (!window?.electronAPI?.getAvailablePrinters) {
      console.warn('Electron API not available for getting printers');
      return;
    }
    try {
      const printers = await window.electronAPI.getAvailablePrinters();
      setAvailablePrinters(printers || []);
      
      // Restore previously selected printer if available
      const savedPrinterName = localStorage.getItem('selectedPrinterName');
      if (savedPrinterName) {
        const savedPrinter = printers.find(p => p.name === savedPrinterName);
        if (savedPrinter) {
          setSelectedPrinter(savedPrinter);
        } else if (printers.length > 0) {
          setSelectedPrinter(printers[0]);
        }
      } else if (printers.length > 0) {
        // Auto-select thermal printer if found
        const thermalPrinter = printers.find(p => 
          p.name.toLowerCase().includes('58') || 
          p.name.toLowerCase().includes('thermal') || 
          p.name.toLowerCase().includes('receipt') ||
          p.name.toLowerCase().includes('xprinter')
        );
        setSelectedPrinter(thermalPrinter || printers[0]);
      }
    } catch (err) {
      console.error('Error fetching printers:', err);
    }
  };

  const handleSelectPrinter = (printer) => {
    setSelectedPrinter(printer);
    localStorage.setItem('selectedPrinterName', printer.name);
    showToast({ type: 'success', message: `Printer set to: ${printer.name}` });
  };

  const toggleAutoPrint = (enabled) => {
    setAutoPrintEnabled(enabled);
    localStorage.setItem('autoPrintEnabled', enabled.toString());
    showToast({ 
      type: 'info', 
      message: enabled ? 'Auto-print enabled' : 'Auto-print disabled' 
    });
  };

  // Check if user is super_admin or supervisor
  const isSuperAdminOrSupervisor = user?.role === 'super_admin' || user?.role === 'supervisor';

  // Persist base salary toggle state to localStorage
  useEffect(() => {
    localStorage.setItem('noBSalarDays', JSON.stringify(noBSalarDays));
  }, [noBSalarDays]);

  useEffect(() => {
    if (!isSuperAdminOrSupervisor) {
      showToast({ type: 'error', message: 'Access denied. Only superadmin and supervisors can view this page.' });
      return;
    }
    fetchTellerSalaryData();
    fetchAvailablePrinters();
  }, [selectedWeek, isSuperAdminOrSupervisor]);

  const fetchTellerSalaryData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Get the week start (Monday) - using local time, not UTC
      const date = new Date(selectedWeek);
      const dayOfWeek = date.getDay();
      const diffToMonday = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const start = new Date(date.setDate(diffToMonday));
      const end = new Date(start);
      end.setDate(end.getDate() + 6); // Sunday

      setWeekStart(start);
      setWeekEnd(end);

      // Format dates as YYYY-MM-DD using local time (not UTC)
      const formatLocalDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const response = await axios.get(
        `${getApiUrl()}/api/teller-salary-calculation`,
        {
          params: {
            weekStart: formatLocalDate(start),
            weekEnd: formatLocalDate(end),
            supervisorId: user?.role === 'supervisor' ? user?.id : undefined
          },
          headers
        }
      );

      setTellers(response.data?.tellers || []);
    } catch (err) {
      console.error('Error fetching teller salary data:', err);
      showToast({ type: 'error', message: 'Failed to load teller salary data' });
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    const date = new Date(selectedWeek);
    date.setDate(date.getDate() - 7);
    setSelectedWeek(date.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const date = new Date(selectedWeek);
    date.setDate(date.getDate() + 7);
    setSelectedWeek(date.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedWeek(new Date().toISOString().split('T')[0]);
  };

  if (!isSuperAdminOrSupervisor) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${dark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-sm opacity-70">You do not have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
            Teller Salary Calculation
          </h1>
          <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
            Weekly overtime and salary summary
          </p>
        </div>

        {/* Week Navigation */}
        <div className={`mb-6 p-4 rounded-lg ${dark ? 'bg-gray-800' : 'bg-white'} shadow-md`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousWeek}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                title="Previous week"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={handleToday}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
              >
                This Week
              </button>
              <button
                onClick={handleNextWeek}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                title="Next week"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Calendar size={18} />
              <input
                type="date"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className={`px-3 py-2 rounded-lg border ${
                  dark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div className={`text-sm font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
              {weekStart && weekEnd && (
                <>
                  {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </>
              )}
            </div>

            {/* Printer Settings Button */}
            <button
              onClick={() => setShowPrinterSettings(!showPrinterSettings)}
              className={`p-2 rounded-lg transition flex items-center gap-2 text-sm font-semibold ${
                showPrinterSettings
                  ? 'bg-indigo-600 text-white'
                  : dark
                  ? 'hover:bg-gray-700 text-gray-300'
                  : 'hover:bg-gray-200 text-gray-700'
              }`}
              title="Printer settings"
            >
              <Settings2 size={18} />
              {selectedPrinter && <span className="hidden sm:inline">{selectedPrinter.name}</span>}
            </button>

            {/* Batch Print Button */}
            {tellers.length > 0 && Object.keys(selectedTellers).length > 0 && (
              <button
                onClick={handleBatchPrint}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                title="Print selected tellers on A4 paper (6 per page)"
              >
                <Printer size={18} />
                <span>Print A4 ({Object.keys(selectedTellers).length})</span>
              </button>
            )}
          </div>

          {/* Printer Settings Panel */}
          {showPrinterSettings && (
            <div className={`mt-4 p-4 rounded-lg border-2 border-indigo-600 ${dark ? 'bg-gray-700' : 'bg-indigo-50'}`}>
              <h3 className={`font-semibold mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>
                <HardDrive size={18} className="inline mr-2" />
                USB Printer Settings
              </h3>
              
              {availablePrinters.length === 0 ? (
                <div className={`text-sm p-2 rounded ${dark ? 'bg-gray-600 text-gray-300' : 'bg-white text-gray-600'}`}>
                  No printers found. Please connect a USB printer.
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {availablePrinters.map((printer) => (
                    <button
                      key={printer.name}
                      onClick={() => handleSelectPrinter(printer)}
                      className={`w-full p-3 rounded-lg text-left transition flex items-center gap-3 ${
                        selectedPrinter?.name === printer.name
                          ? 'bg-indigo-600 text-white'
                          : dark
                          ? 'bg-gray-600 hover:bg-gray-500 text-gray-100'
                          : 'bg-white hover:bg-gray-100 text-gray-900 border'
                      }`}
                    >
                      <HardDrive size={16} />
                      <div>
                        <div className="font-semibold text-sm">{printer.name}</div>
                        {printer.isDefault && (
                          <div className="text-xs opacity-70">(Default Printer)</div>
                        )}
                      </div>
                      {selectedPrinter?.name === printer.name && (
                        <div className="ml-auto">✓</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className={`p-3 rounded-lg border ${dark ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'} mt-3`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPrintEnabled}
                    onChange={(e) => toggleAutoPrint(e.target.checked)}
                    className="rounded"
                  />
                  <span className={`text-sm font-medium ${dark ? 'text-gray-100' : 'text-gray-900'}`}>
                    Auto-print when button clicked
                  </span>
                </label>
                <p className={`text-xs mt-2 ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                  When enabled, clicking print will directly send to the selected printer without showing a preview.
                </p>
              </div>

              <button
                onClick={() => setShowPrinterSettings(false)}
                className="w-full mt-3 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition text-sm"
              >
                Close Settings
              </button>
            </div>
          )}
        </div>

        {/* Teller Cards Grid */}
        <div>
          {tellers.length > 0 && (
            <div className="mb-4 flex gap-2">
              <button
                onClick={toggleSelectAll}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  tellers.length > 0 && Object.keys(selectedTellers).length === tellers.length
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : dark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                {tellers.length > 0 && Object.keys(selectedTellers).length === tellers.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
              {Object.keys(selectedTellers).length > 0 && (
                <span className={`px-4 py-2 rounded-lg font-semibold ${dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-900'}`}>
                  {Object.keys(selectedTellers).length} selected
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tellers.length === 0 ? (
            <div className={`col-span-full p-8 rounded-lg text-center ${dark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>
              <p>No tellers found for this week</p>
            </div>
          ) : (
            tellers.map((teller) => {
              const dailyOver = teller.over || {};
              const totalOver = sumOver(dailyOver);
              const baseSalary = baseSalaryAmount;
              
              // Calculate actual base salary based on included days
              const includedDaysCount = dayLabels.filter(({ key }) => {
                const noBSalaryKey = `${teller.id}-${key}`;
                return noBSalarDays[noBSalaryKey];
              }).length;
              const adjustedBaseWeeklySum = baseSalaryAmount * includedDaysCount;
              const totalCompensation = adjustedBaseWeeklySum + totalOver;

              return (
                <div
                  key={teller.id}
                  className={`rounded-xl shadow-lg overflow-hidden transition transform hover:shadow-xl ${
                    dark ? 'bg-gray-800' : 'bg-white'
                  }`}
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4">
                    <div className="flex justify-between items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleTellerSelection(teller.id)}
                        className="flex-shrink-0 mt-0.5 text-white hover:opacity-80 transition"
                        title="Select for batch print"
                      >
                        {selectedTellers[teller.id] ? (
                          <CheckSquare size={20} />
                        ) : (
                          <Square size={20} />
                        )}
                      </button>
                      <div>
                        <h3 className="text-lg font-bold text-white">{teller.name}</h3>
                        <p className="text-indigo-100 text-sm">Teller ID: {teller.id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrint(teller)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-white text-xs font-semibold transition flex-shrink-0"
                      >
                        <Printer size={14} />
                        Print
                      </button>
                      <button
                        type="button"
                        onClick={() => copyReportToClipboard(teller)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-white text-xs font-semibold transition flex-shrink-0"
                        title="Copy report to clipboard"
                      >
                        <Copy size={14} />
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4">
                    {/* Base Salary */}
                    <div className={`mb-4 p-3 rounded-lg ${dark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Base Salary
                        </span>
                        <span className="text-lg font-bold text-indigo-600">
                          ₱{baseSalary.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Daily Over */}
                    <div className="mb-4">
                      <h4 className={`text-sm font-semibold mb-3 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Daily Over (Cash) - Click to toggle base salary per day
                      </h4>
                      <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b pb-2">
                        <span>Day</span>
                        <span>Over</span>
                        <span>Base Salary</span>
                        <span className="text-center">Include?</span>
                      </div>
                      <div className="space-y-2 mt-3">
                        {dayLabels.map(({ key, label }) => {
                          const overAmount = dailyOver[key] || 0;
                          const tellerId = teller.id;
                          const noBSalaryKey = `${tellerId}-${key}`;
                          const isIncluded = noBSalarDays[noBSalaryKey];
                          const baseSalaryForDay = isIncluded ? baseSalaryAmount : 0;
                          
                          return (
                            <div key={key} className={`grid grid-cols-4 gap-2 items-center p-2 rounded ${
                              !isIncluded 
                                ? dark ? 'bg-gray-800' : 'bg-white' 
                                : dark ? 'bg-green-900/20' : 'bg-green-50'
                            } border ${!isIncluded ? dark ? 'border-gray-700' : 'border-gray-200' : 'border-green-300'}`}>
                              <div className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</div>
                              <div className={`text-sm font-semibold ${
                                overAmount > 0 ? 'text-green-600' : overAmount < 0 ? 'text-red-600' : dark ? 'text-gray-500' : 'text-gray-400'
                              }`}>₱{overAmount.toFixed(2)}</div>
                              <div className={`text-sm font-semibold ${isIncluded ? 'text-green-600' : dark ? 'text-gray-500' : 'text-gray-400 line-through'}`}>
                                ₱{baseSalaryForDay.toFixed(2)}
                              </div>
                              <button
                                onClick={() => toggleBaseSalaryDay(tellerId, key)}
                                className={`px-2 py-1 rounded text-xs font-semibold transition ${
                                  isIncluded
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : dark
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                                }`}
                                title={isIncluded ? 'Click to exclude base salary' : 'Click to include base salary'}
                              >
                                {isIncluded ? 'YES' : 'NO'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Weekly Total Over */}
                    <div className={`pt-3 border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Weekly Over Total
                        </span>
                        <span className={`text-xl font-bold ${totalOver > 0 ? 'text-green-600' : totalOver < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          ₱{totalOver.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Total Compensation */}
                    <div className={`mt-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700`}>
                      <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
                        Total Compensation
                      </div>
                        <div className="text-2xl font-bold text-indigo-600">
                          ₱{totalCompensation.toFixed(2)}
                        </div>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                          Base ({includedDaysCount} days × ₱{baseSalaryAmount}) ₱{adjustedBaseWeeklySum.toFixed(2)} + Over ₱{totalOver.toFixed(2)}
                        </p>
                    </div>
                    <div className="mt-4 border-t border-dashed border-gray-400 pt-3 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex justify-between items-center">
                        <span>Prepared By</span>
                        <div className="border-t border-dashed border-gray-400 w-32" />
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span>Supervisor Signature</span>
                        <div className="border-t border-dashed border-gray-400 w-32" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Summary Stats */}
        {tellers.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Total Tellers</p>
              <p className="text-3xl font-bold text-indigo-600">{tellers.length}</p>
            </div>
            
            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Weekly Base Salary (Each)</p>
              <p className="text-3xl font-bold text-green-600">₱{baseWeeklySum.toFixed(2)}</p>
            </div>

            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Total Weekly Over</p>
              <p className="text-3xl font-bold text-green-600">
                ₱{tellers.reduce((sum, t) => sum + sumOver(t.over), 0).toFixed(2)}
              </p>
            </div>

            <div className={`rounded-xl p-6 ${dark ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>Avg Weekly Over</p>
              <p className="text-3xl font-bold text-purple-600">
                ₱{(tellers.length > 0 ? tellers.reduce((sum, t) => sum + sumOver(t.over), 0) / tellers.length : 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
