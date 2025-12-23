# USB Printer Integration Guide - Teller Salary Calculation

## Overview
The Teller Salary Calculation page now supports automatic USB printer connectivity and printing. Users can:
- **Select a USB printer** from the available printers list
- **Auto-print directly** to the selected printer when the print button is clicked
- **Preview before printing** (optional)
- **Save printer preferences** for future sessions

## Features

### 1. **Printer Selection Panel**
- Click the **Settings icon** (⚙️) next to the week navigation to open the Printer Settings panel
- Shows all available USB printers connected to your system
- Currently selected printer is highlighted in blue with a ✓ checkmark
- Shows which printer is the default system printer

### 2. **Auto-Print Mode**
When enabled, clicking the Print button will:
- ✅ Automatically send the document to your selected USB printer
- ✅ Skip the print preview dialog
- ✅ Show a success message confirming the printer name
- ✅ Use silent printing (no dialogs)

When disabled:
- Opens the browser's print preview dialog
- Allows manual printer selection per print job
- Allows adjusting print settings before printing

### 3. **Printer Detection**
The system automatically:
- Detects all USB printers connected to your computer
- Auto-selects thermal receipt printers if available (58mm, XPrinter, etc.)
- Falls back to the system default printer if no thermal printer is found
- Saves your selected printer preference locally

## Setup Instructions

### Step 1: Connect USB Printer
1. Connect your USB thermal printer to your computer
2. Install the printer drivers if required by Windows
3. The printer should appear in your Windows Printers & Devices settings

### Step 2: Configure in Teller Salary Calculation
1. Navigate to the **Teller Salary Calculation** page (Supervisor/Super Admin only)
2. Click the **Settings button (⚙️)** in the week navigation bar
3. The Printer Settings panel will open showing all available printers

### Step 3: Select Your Printer
1. Click on your USB printer from the list
2. You'll see a confirmation message: "Printer set to: [Printer Name]"
3. The selected printer is now saved for future sessions

### Step 4: Enable Auto-Print (Optional)
1. Check the **"Auto-print when button clicked"** checkbox
2. This enables direct printing without preview dialogs
3. Your preference is automatically saved

## Usage

### Printing a Teller Salary Report
1. Open the Teller Salary Calculation page
2. Navigate to the desired week using the navigation controls
3. Click the **Print button** (🖨️) on any teller's card
4. If auto-print is enabled:
   - Document automatically prints to selected printer
   - Success message appears
5. If auto-print is disabled:
   - Print preview dialog opens
   - Review and adjust settings as needed
   - Click "Print" to send to printer

## Supported Printer Types

### Thermal Receipt Printers (Recommended)
- **58mm thermal printers** (Receipt/POS)
- **XPrinter series** (XP-58IIH, XP-100, etc.)
- **TSC series**
- **Zebra models**

### Standard USB Printers
- Any USB printer installed on your Windows system
- Network printers (if shared locally)
- Brother, HP, Canon, Epson, Ricoh, Xerox, etc.

## Troubleshooting

### Issue: "No printers found" message
**Solution:**
- Check that your USB printer is properly connected
- Install or update printer drivers from the manufacturer's website
- Restart the application
- In Windows Settings > Devices > Printers & Scanners, verify printer is listed

### Issue: Printing doesn't work
**Solution:**
- Verify the printer is set as default or selected in settings
- Check printer is online and not in error state
- Try printing a test page from Windows Printer Settings first
- Check printer has paper/ink and no error lights

### Issue: Wrong printer selected after restart
**Solution:**
- Open Printer Settings and re-select your printer
- The preference should now be saved correctly
- Check browser cookies/local storage is not being cleared on exit

### Issue: Print preview shows but printer selection doesn't work
**Solution:**
- This occurs in web-only mode (not running as Electron app)
- Use the native browser print dialog's printer selection
- For auto-direct printing, the app must be running as a desktop application

## Technical Details

### Data Storage
- Selected printer name is saved in browser's localStorage: `selectedPrinterName`
- Auto-print preference is saved as: `autoPrintEnabled` (true/false)
- These preferences persist across sessions

### Print Format
- Page size: 58mm width (A6 equivalent)
- Format: Receipt-style layout with teller info, daily overtime, totals
- Includes signature lines for supervisors
- Automatically formatted for thermal printer paper

### Supported Platforms
- **Windows 10/11** (Electron app or web browser)
- **Mac** (Electron app - limited thermal printer support)
- **Linux** (Electron app with CUPS printers)

## User Role Requirements
This feature is only available to:
- **Super Admin** users
- **Supervisor** users

Regular tellers cannot access the Teller Salary Calculation page.

## Tips & Best Practices

### ✅ Best Practices
1. **Test your printer first** - Print a test page from Windows before using in the app
2. **Check paper supply** - Ensure your thermal printer has sufficient paper
3. **Save printer selection** - Once set, your preference is remembered
4. **Use auto-print for speed** - Enable auto-print for faster batch printing
5. **Check connectivity regularly** - USB connections can loosen over time

### 🔧 Performance Notes
- First printer detection may take 1-2 seconds on app startup
- Printing is silent and runs in the background
- Multiple prints can be queued without waiting for completion
- Closing settings panel doesn't interrupt active printing

## FAQ

**Q: Can I print to multiple printers?**  
A: Yes, switch the selected printer in settings and continue printing.

**Q: What happens if the printer gets disconnected?**  
A: The app will show an error. Reconnect the printer and refresh the printer list.

**Q: Can I print in color?**  
A: Only if your printer supports color. Most thermal receipt printers print in black only.

**Q: Is there a batch print option?**  
A: Currently, you must print each teller individually. To print all, click each Print button.

**Q: What if I need a print preview?**  
A: Disable auto-print mode to see the browser print preview before printing.

**Q: Can I customize the print format?**  
A: Contact your administrator to modify the print template in the TellerSalaryCalculation.jsx file.

## Support
For technical issues:
1. Check the troubleshooting section above
2. Verify your printer drivers are up to date
3. Check Windows Event Viewer for printer-related errors
4. Contact your system administrator

---

**Last Updated:** December 21, 2025  
**Version:** 1.0
