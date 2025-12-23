# Auto-Update Setup Guide

## Overview
The RMI Teller Report app now has auto-update functionality. Users will automatically receive updates without needing to download and reinstall manually.

## How It Works
1. **Check on startup** — App checks GitHub for new releases
2. **Download** — If a new version exists, it downloads in background
3. **Notify user** — Shows "Update Available" message
4. **Install** — User clicks "Restart Now" to apply update

## Setup Steps (GitHub Releases)

### 1. Create GitHub Repository
You need a GitHub repository to host releases. If you don't have one:
```bash
# Create on GitHub.com at: https://github.com/new
# Name: rmi-teller-report
# Make it PUBLIC (required for auto-update)
```

### 2. Link Your Local Repository
```bash
cd c:\Users\Gideon\OneDrive\Desktop\rmi-teller-report
git init
git remote add origin https://github.com/gideonbot/rmi-teller-report.git
git add .
git commit -m "Initial commit with auto-update support"
git push -u origin main
```

### 3. Update Ownership in package.json (if different)
In `package.json`, update the publish section if your GitHub username isn't "gideonbot":
```json
"publish": {
  "provider": "github",
  "owner": "YOUR_GITHUB_USERNAME",
  "repo": "rmi-teller-report"
}
```

### 4. Bump Version Before Building
Edit `package.json` version field:
```json
"version": "1.0.1"
```

### 5. Build and Create GitHub Release

**Option A: Automatic Publishing (requires GitHub token)**
```bash
# Install release CLI tool
npm install -g electron-builder

# Generate GitHub token at: https://github.com/settings/tokens
# Create token with 'repo' scope, save it

# Set environment variable in PowerShell (elevated)
$env:GH_TOKEN = "your_github_token_here"

# Build and publish
npm run build
electron-builder --win --x64 --publish onTag
```

**Option B: Manual Publishing (simpler)**
1. Build the installer:
   ```bash
   npm run dist
   ```

2. Create release on GitHub:
   - Go to: https://github.com/gideonbot/rmi-teller-report/releases/new
   - Tag: `v1.0.1`
   - Title: `Version 1.0.1`
   - Description: List changes (e.g., "Added thermal printer auto-detection")
   - Upload files from `release/` folder:
     - `RMI Teller Report Setup 1.0.1.exe`
     - `RMI Teller Report Setup 1.0.1.exe.blockmap`
   - Click "Publish release"

### 6. Users Get Auto-Update
Once you've published a GitHub release:
- Installed apps automatically check for updates
- If newer version exists, they see notification
- Update downloads and installs automatically
- Users can choose "Restart Now" or update later

## Version Numbering
When you have a new update:
1. Update `"version"` in `package.json` (e.g., 1.0.0 → 1.0.1)
2. Run `npm run dist` 
3. Create GitHub release with matching tag and uploaded .exe files

## File Location
The app auto-updates from: **GitHub Releases**
(Configured in `package.json` → `build.publish` section)

## Troubleshooting

**Q: How do I check if auto-update is working?**
A: Press `Ctrl+Shift+I` → Console tab, you'll see updater logs

**Q: Users still see old version?**
A: They need to restart the app for update check to run

**Q: How do I test auto-update locally?**
A: During development, auto-updater is disabled. Test by:
1. Publishing a release with v1.0.1
2. Install current v1.0.0 app
3. Restart app → should show update available

**Q: Can I use a different update server?**
A: Yes, change `build.publish.provider` in package.json to:
- `"generic"` — Any web server
- `"s3"` — Amazon S3
- `"spacesProvider"` — DigitalOcean Spaces

## Backend Auto-Updates
Your backend on Render.com already auto-updates on git push. No changes needed there.

## Next Steps
1. Create/link GitHub repository
2. Bump version number in package.json
3. Run `npm run dist` 
4. Create GitHub release with the .exe file
5. Users will automatically get updates on next app restart
