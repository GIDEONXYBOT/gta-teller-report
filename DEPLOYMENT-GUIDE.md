# Deployment Guide for RMI Teller Report System

## Overview
This project has a two-part deployment architecture:
- **Backend**: Render (Node.js/Express + MongoDB)
- **Frontend**: Cloudflare Pages (React + Vite)

---

## Backend Deployment (Render.com)

### Prerequisites
- Render.com account
- MongoDB Atlas account
- GitHub repository connection

### Setup Steps

1. **Create Render Web Service**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository (Rmi-Gideon)
   - Select "rmi-teller-report" repository

2. **Configure Service**
   - **Name**: `rmi-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or upgrade as needed)
   - **Health Check Path**: `/api/health`

3. **Set Environment Variables**
   In the Render dashboard, add these variables:
   ```
   NODE_ENV = production
   MONGO_URI = mongodb+srv://rmi_admin:lD91v9R6zBcKLDQx@rmi-teller-report.fphrmaw.mongodb.net/?appName=rmi-teller-report
   ```

4. **Deploy**
   - Push to main branch
   - Render will automatically build and deploy

### Health Check
Visit `https://your-render-url/api/health` to verify the backend is running.

---

## Frontend Deployment (Cloudflare Pages)

### Prerequisites
- Cloudflare account
- GitHub repository connection
- Render backend URL (from above)

### Setup Steps

1. **Get Cloudflare Credentials**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Go to Account Settings → API Tokens
   - Create token with "Cloudflare Pages" permission
   - Copy: **API Token** and **Account ID**

2. **Add GitHub Secrets**
   Go to GitHub → Repository Settings → Secrets and Variables → Actions

   Add these secrets:
   ```
   CLOUDFLARE_API_TOKEN = <your_api_token>
   CLOUDFLARE_ACCOUNT_ID = <your_account_id>
   VITE_API_URL = https://rmi-backend-zhdr.onrender.com/api
   ```

3. **Create Cloudflare Pages Project**
   - Go to Cloudflare Dashboard → Pages
   - Click "Create a project"
   - Select GitHub and authorize
   - Select "rmi-teller-report" repository
   - **Project name**: `gideon-reports`
   - **Build command**: `npm run build`
   - **Build output directory**: `frontend/dist`

4. **Deploy**
   - The GitHub Actions workflow will automatically deploy on push to main
   - Check `.github/workflows/deploy-pages.yml` status in GitHub Actions

### Access Frontend
Visit `https://gideon-reports.pages.dev` (after first deployment)

---

## Socket.IO Configuration

The application now uses Socket.IO for real-time updates. The frontend automatically connects to the backend's WebSocket endpoint.

### Socket.IO Settings
- **Namespace**: `/chicken-fight`
- **Transport**: WebSocket + Polling fallback
- **Reconnection**: Enabled with exponential backoff

No additional configuration needed - it's built into the app!

---

## Troubleshooting

### Backend Not Starting
```bash
# Check logs in Render dashboard
# Verify MongoDB URI is correct
# Check Node version compatibility
```

### Frontend Build Fails
```bash
# Check GitHub Actions logs
# Verify VITE_API_URL is set correctly
# Ensure all dependencies are installed
```

### No Real-Time Updates
```bash
# Check browser console for Socket.IO connection errors
# Verify backend is accessible at VITE_API_URL
# Check /api/health endpoint
```

### Rate Limiting Errors (429)
The system now uses Socket.IO instead of HTTP polling, which reduces server load significantly. If you still see 429 errors:
1. Check Render plan limits
2. Consider upgrading from Free to Standard plan
3. Verify frontend isn't making excessive HTTP requests

---

## Development vs Production

### Development
```bash
npm run dev
# Frontend runs on http://localhost:5173
# Backend runs on http://localhost:5000
```

### Production
```bash
npm run production
# Builds frontend and runs backend
# Set NODE_ENV=production
```

---

## Database

### MongoDB Atlas Setup
✅ **Already Configured**
- Cluster: rmi-teller-report
- Username: rmi_admin
- Connection String: `mongodb+srv://rmi_admin:lD91v9R6zBcKLDQx@rmi-teller-report.fphrmaw.mongodb.net/?appName=rmi-teller-report`
- Status: Ready for production

Just ensure:
1. IP whitelist includes 0.0.0.0/0 (for Render)
2. Database user has correct permissions
3. Connection string is added as `MONGO_URI` in Render environment variables

---

## Monitoring

### Check Deployment Status
- **Backend**: [Render Dashboard](https://render.com)
- **Frontend**: [Cloudflare Pages Dashboard](https://dash.cloudflare.com/?to=/:account/pages)
- **Logs**: Check GitHub Actions tab for deployment logs

### Health Checks
- Backend: `GET /api/health`
- Frontend: Visit the domain and check console for errors

---

## Rollback

### Backend Rollback
1. Go to Render dashboard
2. Find the previous successful deploy
3. Click "Redeploy"

### Frontend Rollback
1. Go to Cloudflare Pages → gideon-reports
2. Find the previous successful build
3. Click "Rollback to this deployment"

---

## Performance Optimization

### Current Setup
- ✅ Socket.IO instead of HTTP polling (99% fewer requests)
- ✅ Debounced auto-save (1 second delay)
- ✅ Real-time sync across all connected clients
- ✅ Exponential backoff for failed requests
- ✅ Page visibility detection (pause sync when tab inactive)

### Further Optimization
- Consider upgrading Render plan for production
- Enable CDN caching for static assets (Cloudflare)
- Set up monitoring with Sentry for errors
- Add database indexing for frequently queried fields

---

## Next Steps

1. ✅ Set up Render backend service
2. ✅ Set up MongoDB database
3. ✅ Add GitHub secrets for Cloudflare
4. ✅ Create Cloudflare Pages project
5. ✅ Push to main branch
6. ✅ Monitor GitHub Actions for deployment status
7. ✅ Test at frontend URL
8. ✅ Verify real-time sync works

---

**Last Updated**: December 11, 2025
**Version**: 1.0.0
**Status**: Ready for production
