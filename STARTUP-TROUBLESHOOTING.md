# RMI Teller Report - Startup Troubleshooting

## App Won't Open After Installation?

### Quick Fixes:

1. **Try running as Administrator**
   - Right-click the app shortcut
   - Select "Run as Administrator"

2. **Check for Error Logs**
   - Press `Win + R`
   - Type `%APPDATA%\RMI Teller Report`
   - Look for any crash logs or error files

3. **Uninstall and Reinstall**
   - Go to Control Panel → Programs → Uninstall a program
   - Find "RMI Teller Report" and uninstall
   - Download the latest .exe from GitHub
   - Install fresh

4. **Check Port Availability**
   - Make sure port 3000-3001 are not blocked
   - The app needs to reach the backend server

### If Still Not Working:

1. **Disable Auto-Update (Temporary)**
   - Edit config file at: `%APPDATA%\RMI Teller Report\config.json`
   - Set `"autoUpdate": false`

2. **Bypass GitHub Updates**
   - Manually run the app offline mode
   - It will load from local files if internet is unavailable

3. **Enable Debug Mode**
   - When app starts, it will show console logs if available
   - Look for error messages to identify the issue

### Contact Support:

If none of these work, please check:
- GitHub releases page for latest version
- Your internet connection is working
- Your firewall isn't blocking the app

---

## Recent Updates:

### Fixed in Latest Version:
- ✅ Corrected GitHub publisher configuration
- ✅ Improved startup error handling with debug logging
- ✅ Fixed latest.yml filename format
- ✅ Added better error messages during app launch

### What to Expect:
- App checks for updates on startup
- Shows notification in bottom-right if update available
- Continues to work while downloading updates
- Requires restart to install updates
