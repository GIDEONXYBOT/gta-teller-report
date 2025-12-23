# RMI Teller Report - Changes Summary (Today)

## 🎯 Main Issues Addressed

### ⚙️ Daily Reset Time Updated
**Change:** Default daily reset (previously midnight) moved to 04:00 (Asia/Manila) on 2025-11-29. You can still override this with the `RESET_TIME` environment variable or via the Admin > Daily Reset Time UI.


### 1. Base Salary Not Reflecting for Yesterday's Reports
**Problem:** Users who submitted reports yesterday didn't have their base salary showing in payroll.

**Root Cause:** Payroll sync wasn't updating baseSalary from User model when reports were added.

**Files Changed:**
- `backend/routes/tellerReports.js` - syncPayrollFromReports function
- `backend/routes/payroll.js` - sync-teller-reports endpoint
- `backend/routes/teller-management.js` - add-capital supervisor payroll creation

**Solution:**
```javascript
// Always fetch user and sync baseSalary when updating payroll
const user = await User.findById(tellerId);
if ((payroll.baseSalary || 0) !== (user.baseSalary || 0)) {
  payroll.baseSalary = user.baseSalary || 0;
}
```

**New Endpoints Added:**
- `POST /api/payroll/sync-month-all` - Sync all users' base salaries for current month
- `POST /api/payroll/sync-yesterday-capital` - Backfill base salaries for users with capital added yesterday

---

### 2. Hybrid Supervisor/Teller Role
**Problem:** Some users need to function as both supervisor and teller.

**Files Changed:**
- `backend/models/User.js` - Added "supervisor_teller" to role enum
- `backend/routes/payroll.js` - Include supervisor_teller in sync queries
- `backend/routes/teller-management.js` - Treat supervisor_teller as both roles
- `frontend/src/main.jsx` - Updated ProtectedRoute to accept allowedRoles array
- `frontend/src/pages/AdminUserApproval.jsx` - Added supervisor_teller option
- `frontend/src/pages/PayrollManagement.jsx` - Added supervisor_teller filter
- `frontend/src/pages/RegisterPage.jsx` - Added supervisor_teller option
- `frontend/src/pages/LoginPage.jsx` - Added supervisor_teller navigation

**Implementation:**
```javascript
// User model
role: {
  type: String,
  enum: ["admin", "supervisor", "teller", "supervisor_teller"],
  default: "teller",
}

// ProtectedRoute logic
const ok = roles.includes(urole) || 
  (urole === "supervisor_teller" && 
   (roles.includes("teller") || roles.includes("supervisor")));
```

---

### 3. Mobile Login/Registration Issues
**Problem:** Users couldn't log in or register from mobile devices.

**Files Changed:**
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/pages/RegisterPage.jsx`
- `backend/routes/auth.js`

**Changes Made:**

#### A. Responsive Layout
```jsx
// Before: Fixed width
<div className="w-96">

// After: Responsive with mobile padding
<div className="px-4">
  <div className="w-full max-w-md p-6 sm:p-8">
```

#### B. Mobile Keyboard Handling
```jsx
<input
  text-base             // Prevents iOS zoom
  autoComplete="username"
  autoCapitalize="none"   // No auto-caps
  autoCorrect="off"       // No autocorrect
  spellCheck="false"      // No spellcheck
/>
```

#### C. Debug Logging
Both frontend and backend now have detailed console logging:
- Username/password validation
- API URL being called
- Hash comparison results
- Error details

#### D. Network Access Issue
**CRITICAL DISCOVERY:** Mobile devices cannot access `localhost:5000`

**Solution Required:**
1. Get your computer's local IP address
2. Update `frontend/.env`:
   ```
   VITE_API_URL=http://YOUR_LOCAL_IP:5000
   ```
3. Both devices must be on same Wi-Fi network
4. Access from mobile: `http://YOUR_LOCAL_IP:5173`

---

### 4. PayrollManagement Hide Zero Salary
**Files Changed:**
- `frontend/src/pages/PayrollManagement.jsx`

**Added:**
- "Hide zero salary" checkbox (default: true)
- Filters out entries with totalSalary <= 0
- Summary metrics remain unchanged

---

## 🔧 Backend Changes Summary

### Models Modified
- `User.js` - Added supervisor_teller role

### Routes Modified
1. **auth.js**
   - Enhanced login with detailed logging
   - Password hash migration logic
   - PlainText fallback for compatibility

2. **payroll.js**
   - Added sync-month-all endpoint
   - Added sync-yesterday-capital endpoint
   - Import Capital model for yesterday sync

3. **tellerReports.js**
   - syncPayrollFromReports now always updates baseSalary from User

4. **teller-management.js**
   - add-capital creates supervisor base-only payroll
   - Queries include supervisor_teller in teller lists
   - Import Payroll model

### Server
- Added request logging middleware
- Created helper scripts: test-login.js, show-mobile-urls.js

---

## 🎨 Frontend Changes Summary

### Pages Modified
1. **LoginPage.jsx**
   - Responsive layout with px-4, max-w-md
   - Mobile keyboard attributes
   - Debug logging
   - Username trim on submit
   - supervisor_teller navigation

2. **RegisterPage.jsx**
   - Same responsive fixes as LoginPage
   - Added supervisor_teller option
   - Debug logging

3. **AdminUserApproval.jsx**
   - Added supervisor_teller to edit modal dropdown

4. **PayrollManagement.jsx**
   - Added supervisor_teller filter option
   - Added "Hide zero salary" toggle

5. **SidebarLayout.jsx**
   - Adjusted payroll label logic for hybrid role

### Router (main.jsx)
- ProtectedRoute now accepts `allowedRoles` array
- supervisor_teller can access both teller and supervisor routes

---

## 🚀 How to Test Everything

### 1. Start Servers
```powershell
# Backend
cd backend
npm start

# Frontend (in new terminal)
cd frontend
npm run dev -- --host
```

### 2. Get Network URLs (for mobile)
```powershell
cd backend
node show-mobile-urls.js
```

### 3. Update .env with Network IP
Edit `frontend/.env`:
```
VITE_API_URL=http://192.168.x.x:5000
```
(Replace with IP from step 2)

### 4. Test Desktop Login
- Open http://localhost:5173
- Login with existing user
- Check console logs for debug info

### 5. Test Mobile Login
- Connect mobile to SAME Wi-Fi
- Open http://192.168.x.x:5173 (your network IP)
- Try login - check mobile browser console
- Check backend terminal for request logs

### 6. Sync Yesterday's Base Salaries
```powershell
# Using curl or Postman
POST http://localhost:5000/api/payroll/sync-yesterday-capital

# Or sync entire current month
POST http://localhost:5000/api/payroll/sync-month-all
```

### 7. Test Hybrid Role
- Create user with role "supervisor_teller"
- Login
- Access both /supervisor/dashboard and /teller/dashboard
- Submit teller report - check over/short accumulates
- Add capital as supervisor - check base salary appears

---

## 🐛 Known Issues & Troubleshooting

### Issue: "Invalid username or password" on mobile
**Check:**
1. Backend logs show request arriving?
2. Frontend console shows correct API URL?
3. Is it `localhost:5000` (won't work on mobile)?
4. User exists and is approved?
5. Password stored correctly in DB?

**Debug Steps:**
```javascript
// Check user in MongoDB
db.users.findOne({ username: "testuser" })

// Check password field and plainTextPassword field
```

### Issue: Base salary still showing 0
**Solutions:**
```powershell
# Run sync endpoint
POST /api/payroll/sync-month-all

# Or for specific user
POST /api/payroll/sync-teller-reports
Body: { userId: "USER_ID" }
```

### Issue: Mobile can't connect
**Checklist:**
- [ ] Both devices on same Wi-Fi
- [ ] Backend running on 0.0.0.0 (already configured)
- [ ] Frontend .env uses network IP (not localhost)
- [ ] Firewall allows port 5000 and 5173
- [ ] Frontend dev server running with --host flag

---

## 📊 Database Changes Needed

No schema changes, but you may need to:

1. **Update existing users with supervisor_teller role:**
```javascript
db.users.updateOne(
  { username: "example" },
  { $set: { role: "supervisor_teller" } }
)
```

2. **Backfill base salaries:**
Run the sync endpoints mentioned above.

---

## 🔐 Password System

Current implementation supports THREE formats:
1. **Hashed (bcrypt)** - Preferred, secure
2. **Plain text** - Auto-migrates to hashed on login
3. **PlainTextPassword field** - Fallback for admin visibility

Migration happens automatically on login.

---

## ✅ Testing Checklist

- [ ] Desktop login works
- [ ] Desktop registration works
- [ ] Mobile login works (with network IP)
- [ ] Mobile registration works
- [ ] supervisor_teller can access both dashboards
- [ ] Base salary shows after report submission
- [ ] Base salary shows after capital addition
- [ ] Hide zero salary filter works
- [ ] Sync endpoints restore missing base salaries
- [ ] Debug logs visible in both consoles

---

## 📝 Next Steps

1. **Test mobile connectivity:**
   - Run `node show-mobile-urls.js`
   - Update .env
   - Test from mobile device

2. **Backfill base salaries:**
   - Run sync-month-all endpoint
   - Verify in PayrollManagement page

3. **Clean up (optional):**
   - Remove debug console.logs after testing
   - Remove test scripts (test-login.js, show-mobile-urls.js)

---

## 📞 Quick Commands Reference

```powershell
# Show mobile URLs
node backend/show-mobile-urls.js

# Test login endpoint
node backend/test-login.js

# Start backend
cd backend && npm start

# Start frontend (network accessible)
cd frontend && npm run dev -- --host

# Sync all base salaries
curl -X POST http://localhost:5000/api/payroll/sync-month-all

# Sync yesterday's capital users
curl -X POST http://localhost:5000/api/payroll/sync-yesterday-capital
```

---

**Last Updated:** Today's session
**Status:** Ready for testing with network IP configuration
