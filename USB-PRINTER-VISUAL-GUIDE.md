# USB Printer Integration - Visual Guide

## User Interface Changes

### Teller Salary Calculation Page - Navigation Bar

```
┌─────────────────────────────────────────────────────────────────┐
│  [◄] [This Week] [►]  │  📅 [Date Input]  │  Nov 25 - Dec 01  │  ⚙️ [Printer Name]  │
└─────────────────────────────────────────────────────────────────┘
                                                      ↑
                                            Click to expand
                                           Printer Settings
```

### Printer Settings Panel (When Expanded)

```
┌──────────────────────────────────────────────────────┐
│  🖲️ USB PRINTER SETTINGS                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Available Printers:                                 │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🖲️ XPrinter 58mm Thermal              [✓]     │ │
│  │    (Selected)                                   │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🖨️  HP LaserJet Pro M404n                      │ │
│  │    (Default Printer)                            │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🖨️  Ricoh MP C3503                             │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ☑️  Auto-print when button clicked           │   │
│  │                                              │   │
│  │ When enabled, clicking print will directly   │   │
│  │ send to the selected printer without showing │   │
│  │ a preview dialog.                            │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│                  [Close Settings]                    │
└──────────────────────────────────────────────────────┘
```

### Teller Salary Card (with Print Button)

```
┌────────────────────────────────────────────────┐
│  ┌─ John Doe                    [🖨️ Print] ─┐ │
│  │ Teller ID: T-001                          │ │
│  ├────────────────────────────────────────────┤ │
│  │                                            │ │
│  │  Base Salary    ₱3,150.00                  │ │
│  │                                            │ │
│  │  Daily Over (Cash)                         │ │
│  │  ─────────────────────────                 │ │
│  │  Mon  ₱45.00    ₱450.00                    │ │
│  │  Tue  ₱60.00    ₱450.00                    │ │
│  │  Wed  ₱30.00    ₱450.00                    │ │
│  │  ...                                       │ │
│  │                                            │ │
│  │  Weekly Over Total    ₱315.00              │ │
│  │  Total Compensation   ₱3,465.00            │ │
│  │                                            │ │
│  │  Prepared By  ___________________           │ │
│  │  Supervisor   ___________________           │ │
│  └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
       ↑
   Click Print button to print this report
```

## Data Flow Diagram

```
┌─────────────────────┐
│ Teller Salary Page  │
│  (React Component)  │
└──────────┬──────────┘
           │
           │ 1. Click Settings (⚙️)
           ▼
┌─────────────────────────────────┐
│  Printer Settings Panel         │
│  - fetchAvailablePrinters()     │
│  - handleSelectPrinter()        │
│  - toggleAutoPrint()            │
└──────────┬──────────────────────┘
           │
           │ 2. Call Electron API
           ▼
┌──────────────────────────────────┐
│ Electron Preload (IPC Bridge)   │
│  - getAvailablePrinters()       │
│  - printHTML(html, printer)     │
└──────────┬───────────────────────┘
           │
           │ 3. IPC Invoke
           ▼
┌──────────────────────────────────┐
│ Electron Main Process            │
│  - getAvailablePrinters()        │
│  - printHtml(html, selected)     │
└──────────┬───────────────────────┘
           │
           │ 4. System Printer API
           ▼
┌──────────────────────────────────┐
│ Windows Printer Subsystem        │
│  - Get printer list              │
│  - Send print job                │
└──────────┬───────────────────────┘
           │
           ▼
     ┌───────────┐
     │  🖲️ USB  │
     │ Printer   │
     └───────────┘
```

## State Management

```
TellerSalaryCalculation Component

State Variables:
├── availablePrinters: Printer[]
│   └── { name: "XPrinter 58mm", isDefault: false }
│
├── selectedPrinter: Printer | null
│   └── Stored in localStorage as "selectedPrinterName"
│
├── showPrinterSettings: boolean
│   └── Controls UI visibility
│
└── autoPrintEnabled: boolean
    └── Stored in localStorage as "autoPrintEnabled"


localStorage Keys:
├── "selectedPrinterName"    → "XPrinter 58mm"
└── "autoPrintEnabled"       → "true" | "false"
```

## Print Flow

### With Auto-Print Enabled

```
User clicks Print
    ↓
handlePrint(teller)
    ↓
Validate printer selected
    ↓
Build HTML from teller data
    ↓
Send to Electron: printHTML(html, selectedPrinter)
    ↓
Electron finds printer by device name
    ↓
Send to Windows Print Queue
    ↓
🖲️ USB Printer prints
    ↓
Toast: "Printing to XPrinter 58mm..." ✅
```

### With Auto-Print Disabled

```
User clicks Print
    ↓
handlePrint(teller)
    ↓
Build HTML from teller data
    ↓
Send to Electron: printHTML(html, selectedPrinter)
    ↓
Opens print preview window
    ↓
User selects printer in dialog
    ↓
User clicks Print
    ↓
🖲️ Printer prints
```

## Printer Auto-Detection Logic

```
Initialize Printer Selection
    ↓
Call getAvailablePrinters()
    ↓
Check localStorage for "selectedPrinterName"
    ├─ YES ─ Found saved printer
    │         └─ Restore and use it
    │
    └─ NO ─ Try auto-detect logic
            ├─ Look for thermal printer (58mm, XPrinter, TSC)
            │   ├─ YES ─ Use thermal printer
            │   └─ NO
            │
            └─ Look for default printer
                ├─ YES ─ Use default
                └─ NO ─ Use first available
```

## Supported Printer Names (Auto-Detection)

Thermal printers are detected if name contains:
- "58"
- "thermal"
- "receipt"
- "tsc"
- "xprinter"

Example matches:
- ✅ XPrinter 58mm Thermal Receipt Printer
- ✅ TSC TDP-247 58mm
- ✅ Zebra GC420 Thermal
- ✅ Brother QL-810W Receipt Label Printer
- ✅ SEWOO LK-P45 58mm Portable Printer
- ❌ HP LaserJet Pro (would use as fallback only)
- ❌ Ricoh MP C3503 (standard office printer)

## Error Handling

```
Error Scenario          │ Response
────────────────────────┼─────────────────────────────────────
No printers found       │ Show UI message: "No printers found"
Printer disconnected    │ Fall back to default printer
Selection missing       │ Auto-select first available
API unavailable         │ Use browser print dialog
Print job fails         │ Log to console, show generic error
```

---

**Visual Guide Version:** 1.0  
**Updated:** December 21, 2025
