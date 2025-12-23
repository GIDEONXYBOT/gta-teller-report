# xPrint 58IIH Thermal Printer Setup Guide

## Quick Setup Steps

### 1. Install Printer Driver
1. Download the xPrint 58IIH driver from manufacturer website
2. Run the installer
3. Connect printer via USB
4. Wait for Windows to recognize the device

### 2. Configure Printer in Windows
1. Open **Settings** → **Devices** → **Printers & scanners**
2. Find **xPrint 58IIH** in the list
3. Click on it → **Manage** → **Printer properties**
4. Go to **Advanced** tab:
   - Set **Paper size**: Custom (58mm x 297mm) or "Roll Paper 58mm"
   - **Print quality**: Normal or Draft (faster)
5. Go to **Device Settings** tab:
   - Set **Form to Tray Assignment**: All to Auto Select
6. Click **Apply** and **OK**

### 3. Test Print
1. Right-click printer → **Printer properties**
2. Click **Print Test Page**
3. If successful, the printer is ready!

### 4. Use in App
1. Open the app
2. Go to **Teller Reports** page
3. Click the **printer/Bluetooth icon** (top right)
4. Select **xPrint 58IIH Thermal Printer** from the list
5. Click **Save Settings**
6. Submit a test report and click **Print**

## Troubleshooting

### Printer Not Showing in App
- Refresh the browser page
- Check if printer is set as **default** in Windows
- Make sure printer is **Online** (not paused/offline)

### Print Quality Issues
- Clean the thermal print head with isopropyl alcohol
- Check paper roll is installed correctly (thermal side facing print head)
- Adjust darkness setting in printer properties

### Print Doesn't Start
- Check USB cable is connected properly
- Make sure printer has power (LED should be on)
- Try restarting the printer
- Check Windows print queue for stuck jobs

### Wrong Paper Size
- Receipt too wide/narrow → Adjust paper size in printer properties
- Text cut off → Change margins to 0mm or minimum

## ESC/POS Commands (Advanced)
The xPrint 58IIH supports standard ESC/POS commands:
- Baud rate: Usually 9600 or 115200 for USB
- Data bits: 8
- Parity: None
- Stop bits: 1

## Contact Support
If issues persist, contact your system administrator or xPrint support.
