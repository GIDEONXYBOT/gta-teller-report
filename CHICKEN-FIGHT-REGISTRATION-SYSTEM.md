# 🐔 Chicken Fight System - Refactored to Entry Registration

## What Changed

The Chicken Fight system has been completely redesigned from a **betting platform** to an **entry registration system** that tracks registration fees and payment status.

## New Features

### 1. Entry Registration Management
- **Register entries** for specific game types (2-Wins or 3-Wins)
- **Track registration fees**:
  - 2-Wins: ₱500 per entry
  - 3-Wins: ₱1,000 per entry
- **Mark payments** when fees are collected
- **View statistics** on total registrations and revenue

### 2. Backend Models & APIs

#### New Model: ChickenFightRegistration
```javascript
{
  entryId: ObjectId,
  entryName: String,
  gameDate: Date,
  registrations: [
    {
      gameType: '2wins' | '3wins',
      registrationFee: Number,
      isPaid: Boolean,
      paidDate: Date,
      paidBy: String
    }
  ],
  createdBy: String,
  updatedBy: String
}
```

#### New API Routes
**Base URL:** `/api/chicken-fight-registration/`

1. **GET /registrations**
   - Get all registrations for a specific date
   - Query params: `gameDate` (required)
   - Returns: Array of registration records

2. **POST /registrations**
   - Register an entry for one or more game types
   - Body: `{ entryId, entryName, gameTypes[], gameDate }`
   - Returns: Created registration record

3. **PUT /registrations/:id/pay**
   - Mark a registration fee as paid
   - Body: `{ gameType }`
   - Records: timestamp and user who marked it paid

4. **GET /registrations-stats**
   - Get statistics for a specific date
   - Returns: Total registrations, paid count, revenue

5. **DELETE /registrations/:id**
   - Remove a registration record

### 3. Frontend UI Redesign

#### Main Chicken Fight Page (`ChickenFight.jsx`)
The page now shows:

**Statistics Dashboard:**
- Total entries registered
- 2-Wins entries: paid/total count with revenue
- 3-Wins entries: paid/total count with revenue
- Total revenue collected

**Registration Form:**
- Dropdown to select entry from available entries
- Checkboxes to select game types (2-Wins, 3-Wins, or both)
- Button to register the entry

**Registration Table:**
- Entry Name
- 2-Wins status with "Mark Paid" button
- 3-Wins status with "Mark Paid" button
- Total fees for that entry
- Delete button

**Dark Mode Support:** Full dark mode styling throughout

### 4. How It Works

1. **Admin creates entries** via ChickenFightEntries page
   - Entry name + leg band numbers
   - Sets game type (2-Wins or 3-Wins)

2. **Admin registers entries** via ChickenFight page
   - Selects entry from dropdown
   - Checks which game types they want to register for
   - Clicks "Register Entry"

3. **Track payment status**
   - Table shows each registration and its payment status
   - Click "Mark Paid" when handler collects the fee
   - System records who collected payment and when

4. **View statistics**
   - See total entries registered
   - Track revenue by game type
   - Monitor payment collection progress

## Files Changed

### Backend
- **NEW:** `backend/models/ChickenFightRegistration.js` - Registration data model
- **NEW:** `backend/routes/chicken-fight-registration.js` - 5 new API endpoints
- **MODIFIED:** `backend/server.js` - Import and mount new routes

### Frontend
- **MODIFIED:** `frontend/src/pages/ChickenFight.jsx` - Complete redesign from betting to registration
- **UNCHANGED:** `frontend/src/pages/ChickenFightEntries.jsx` - Still used to create entries

## API Integration Examples

### Register an Entry
```javascript
POST /api/chicken-fight-registration/registrations
{
  "entryId": "674fe31700000000",
  "entryName": "Gideon's Chicken",
  "gameTypes": ["2wins", "3wins"],
  "gameDate": "2025-12-08"
}
```

### Mark Payment Collected
```javascript
PUT /api/chicken-fight-registration/registrations/67abc123/pay
{
  "gameType": "2wins"
}
```

### Get Daily Statistics
```javascript
GET /api/chicken-fight-registration/registrations-stats?gameDate=2025-12-08
```

Response:
```javascript
{
  "total": 5,
  "by2wins": 3,
  "by3wins": 2,
  "paid2wins": 2,
  "paid3wins": 1,
  "unpaid2wins": 1,
  "unpaid3wins": 1,
  "totalRevenue": 2500  // 2 * 500 + 1 * 1000
}
```

## User Workflow

1. **Day Setup (Morning)**
   - Create entries via ChickenFightEntries page
   - Register entries via main ChickenFight page
   - Specify which game types each entry competes in

2. **During Event**
   - Collect registration fees from handlers
   - Mark each fee as paid in the table
   - View real-time revenue tracking

3. **End of Day**
   - Export/view registration report
   - Confirm all fees collected
   - Archive daily record

## Technical Notes

- All endpoints require authentication (`requireAuth` middleware)
- Dates are stored as ISO strings (YYYY-MM-DD)
- Registration fees are hardcoded (2wins: 500, 3wins: 1000)
- Multiple registrations can be created for same entry on different dates
- Payment tracking includes timestamp and username

## Status

✅ **Fully Implemented & Deployed**
- Backend models created
- API routes functional
- Frontend UI complete
- Build passing
- Code committed and pushed to GitHub
