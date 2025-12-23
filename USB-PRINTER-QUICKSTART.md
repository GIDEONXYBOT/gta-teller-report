# USB Printer Integration - Quick Start

## What Was Added

✅ **USB Printer Selection Panel** - Choose which printer to use  
✅ **Auto-Print Mode** - Print directly without dialogs  
✅ **Printer Detection** - Automatically finds USB/thermal printers  
✅ **Persistent Settings** - Remembers your printer choice  

## How to Use It

### 1. Open Teller Salary Calculation (Supervisor/Super Admin only)
- Navigate to the Teller Salary Calculation page

### 2. Configure Your Printer
- Click the **⚙️ Settings icon** in the week navigation bar
- All connected USB printers will be listed
- Click to select your printer
- Check "Auto-print when button clicked" (optional)

### 3. Print Teller Reports
- Click the **Print (🖨️)** button on any teller's salary card
- If auto-print enabled: Prints immediately ✨
- If auto-print disabled: Shows print preview first

## Key Features

| Feature | Description |
|---------|-------------|
| **Auto-Detect** | Finds thermal receipt printers automatically |
| **Multiple Printers** | Switch between printers anytime |
| **Remember Settings** | Your printer choice is saved |
| **58mm Thermal** | Optimized for receipt printers (XPrinter, TSC, etc.) |
| **Fallback Mode** | Uses browser print dialog if USB printer unavailable |

## Troubleshooting

**No printers showing?**
- Check USB printer is connected and powered on
- Install printer drivers from manufacturer
- Restart the app

**Print not working?**
- Select printer again from settings panel
- Verify printer appears in Windows Printers & Devices
- Check printer has paper and no error lights

**Wrong printer selected after restart?**
- Open settings and reselect your printer
- Preference will save correctly

## Technical Details

### Files Modified
- `frontend/src/pages/TellerSalaryCalculation.jsx` - Added printer UI and logic
- `electron/main.js` - Added printer detection and selection
- `electron/preload.js` - Exposed printer APIs to frontend

### New Capabilities
- `getAvailablePrinters()` - Lists all USB printers
- `printHTML(html, printer)` - Prints with specific printer selection
- Persistent localStorage for preferences

### Browser Support
- ✅ Electron App (full support with auto-print)
- ⚠️ Web Browser (print preview only, no auto-print)

## Next Steps

1. **Test with your USB printer**
   - Connect USB printer
   - Open Teller Salary Calculation page
   - Click Settings to see available printers

2. **Configure auto-print** (optional)
   - Enable auto-print checkbox
   - Test printing a teller report
   - Verify it prints without dialogs

3. **Save your preference**
   - Your selected printer is automatically saved
   - Won't need to reconfigure next time

## Questions?

Refer to:
- [Detailed Setup Guide](USB-PRINTER-SETUP-GUIDE.md)
- [Implementation Details](USB-PRINTER-IMPLEMENTATION.md)

---

**Version:** 1.0  
**Date:** December 21, 2025
