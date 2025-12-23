# GTA Teller Report - Setup Guide

This is a duplicate of the RMI Teller Report app configured for the GTA site with its own separate backend.

## What's Been Done

✅ App duplicated and renamed to "GTA Teller Report"
✅ All branding updated (package.json, electron/main.js, workspace file)
✅ Ready for custom configuration

## Next Steps Required

### 1. **Create a New GitHub Repository**

- Go to https://github.com/new
- Repository name: `gta-teller-report`
- Description: `GTA Teller Report - Teller salary management system`
- Make it **Private** (or Public if you prefer)
- Create repository

### 2. **Initialize Git & Push to GitHub**

```powershell
cd c:\Users\Gideon\OneDrive\Desktop\gta-teller-report
git add -A
git commit -m "Initial commit: GTA Teller Report setup"
git branch -M main
git remote add origin https://github.com/GIDEONXYBOT/gta-teller-report.git
git push -u origin main
```

Replace `GIDEONXYBOT` with your GitHub username if different.

### 3. **Set Up New Backend on Render.com**

You'll need a new backend service for GTA (separate database):

1. **Duplicate the backend setup:**
   - Create a new MongoDB database for GTA (different from RMI)
   - Or create a new MongoDB Atlas cluster specifically for GTA

2. **Deploy GTA Backend to Render:**
   - Create new Render service (or use existing account)
   - Push `backend/` folder to separate repository: `gta-backend`
   - Deploy from: `https://github.com/GIDEONXYBOT/gta-backend`
   - Set environment variables:
     - `MONGODB_URI`: Your new GTA MongoDB connection string
     - `JWT_SECRET`: New secret key (different from RMI)
     - `PORT`: 3001 (or different port)

3. **Get the Backend URL:**
   - After deployment, you'll get: `https://gta-backend-xxxx.onrender.com`

### 4. **Update API Configuration**

Edit `frontend/src/utils/apiConfig.js` and update the backend URL:

```javascript
const getApiUrl = () => {
  if (isDev) {
    return 'http://localhost:3001'; // Your GTA backend port
  }
  return 'https://gta-backend-xxxx.onrender.com'; // Your GTA backend URL
};
```

### 5. **Set Up Frontend Deployment**

Deploy frontend to **Cloudflare Pages**:

1. Connect your new `gta-teller-report` GitHub repository
2. Build settings:
   - Build command: `cd frontend && npm run build`
   - Build output: `frontend/dist`
3. Custom domain (optional):
   - You can use: `https://gta.gideonbot.xyz`
   - Or: `https://gta-teller.your-domain.com`

### 6. **Update GitHub Publish Config**

Edit `package.json` - update the `publish` section:

```json
"publish": {
  "provider": "github",
  "owner": "GIDEONXYBOT",
  "repo": "gta-teller-report"
}
```

### 7. **Build Desktop App**

```powershell
cd c:\Users\Gideon\OneDrive\Desktop\gta-teller-report\frontend
npm install
npm run build

cd ..
npx electron-builder --win --x64
```

### 8. **Create GitHub Release**

```powershell
cd c:\Users\Gideon\OneDrive\Desktop\gta-teller-report
git tag -a v1.0.0 -m "GTA Teller Report v1.0.0 - Initial Release"
git push origin v1.0.0
```

The .exe will be uploaded to GitHub releases automatically.

## Key Differences from RMI App

| Aspect | RMI | GTA |
|--------|-----|-----|
| **Backend URL** | https://rmi-backend-zhdr.onrender.com | https://gta-backend-xxxx.onrender.com |
| **Database** | RMI MongoDB | GTA MongoDB (separate) |
| **Frontend URL** | https://rmi.gideonbot.xyz | https://gta.gideonbot.xyz |
| **GitHub Repo** | GIDEONXYBOT/Rmi-Gideon | GIDEONXYBOT/gta-teller-report |
| **App Title** | RMI Teller Report | GTA Teller Report |
| **Download** | GitHub releases (gta-teller-report) | GitHub releases (gta-teller-report) |

## Features Included

✅ Per-day base salary toggles  
✅ A4 batch printing (6 cards per page)  
✅ Auto-update system  
✅ Developer tools (F12)  
✅ Copy report to clipboard  
✅ Thermal printer support  
✅ localStorage persistence  
✅ Role-based access control  

## Database Setup

The GTA backend needs its own database. You have two options:

### Option 1: New MongoDB Atlas Cluster (Recommended)
- Creates complete isolation from RMI data
- More secure and manageable
- Better for multi-site scaling

### Option 2: Separate MongoDB Database in Existing Cluster
- Uses same MongoDB cluster but different database name
- Lower cost option
- Must use different database name: `gta_teller_db` (vs RMI's `rmi_teller_db`)

Update backend `backend/models/` to reference the new database collection.

## Support

For issues or questions, refer to:
- Original RMI docs: `rmi-teller-report/README.md`
- Backend setup: `backend/README.md` or `backend/setup-rmi-backend.bat`
- Frontend setup: `frontend/README.md`

## Quick Command Reference

```powershell
# Navigate to GTA app
cd c:\Users\Gideon\OneDrive\Desktop\gta-teller-report

# Install dependencies
npm install && cd frontend && npm install && cd ..

# Build frontend
cd frontend && npm run build && cd ..

# Build desktop app
npx electron-builder --win --x64

# Start dev environment (if needed)
npm run dev
```

---

**Created:** December 23, 2025  
**App Name:** GTA Teller Report v1.0.0  
**Status:** Ready for deployment
