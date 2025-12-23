# Teller Management Historical Data Access

## Overview
SuperAdmins can now view all teller management data even after reports have been submitted by tellers, and can check past teller management records using date range filtering.

## Features Implemented

### 1. Date Range Filtering
- **Single Date Mode** (Default): View teller management for a specific date
- **Date Range Mode** (New): View teller management across multiple dates
  - Only available for SuperAdmins
  - Toggle between modes using "📅 Range" / "📅 Single" buttons

### 2. Frontend Changes

#### File: `frontend/src/pages/TellerManagement.jsx`

**New State Variables:**
```javascript
const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]); // Date range start
const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]); // Date range end
const [showDateRange, setShowDateRange] = useState(false); // Toggle between single date and range
```

**Updated fetchTellers() Function:**
- Now accepts `showDateRange`, `startDate`, `endDate` parameters
- For Admin/SuperAdmin: Passes date range to `/api/admin/teller-overview` endpoint
- For Supervisors: Passes date range to `/api/teller-management/tellers` endpoint
- Backward compatible with single date queries via `dateKey` parameter

**Updated useEffect:**
- Added `startDate`, `endDate`, `showDateRange` to dependencies
- Automatically refetches data when date range changes

**Enhanced Date Picker UI:**
- Single date mode: Shows date input with "Range" button
- Date range mode: Shows "From" and "To" date inputs with "Single" button
- Visual indicators show current viewing mode

### 3. Backend Changes

#### File: `backend/routes/teller-management.js`

**Updated `/api/teller-management/tellers` Endpoint:**
- Now accepts query parameters:
  - `startDate` (optional): Start of date range (YYYY-MM-DD)
  - `endDate` (optional): End of date range (YYYY-MM-DD)
  - `dateKey` (optional): Single date for backward compatibility
  
- Query Logic:
  - If `startDate` and `endDate` provided: Uses date range for transaction queries
  - Otherwise: Uses `dateKey` (single date) for backward compatibility
  
- Response includes:
  - Transaction data within the specified date range
  - Capital records and balances
  - Transaction summaries for the period

#### File: `backend/routes/adminTellerOverview.js`

**Updated `/api/admin/teller-overview` Endpoint:**
- Now accepts query parameters:
  - `startDate` (optional): Start of date range
  - `endDate` (optional): End of date range
  - `date` (optional): Single date for backward compatibility
  
- Query Logic:
  - If `startDate` and `endDate` provided: Uses date range for all transaction queries
  - Otherwise: Uses single date (backward compatible)

## How to Use

### For SuperAdmins:

1. **Navigate to Capital Management Page** (Teller Management)
2. **Switch to Date Range Mode**:
   - Click the "📅 Range" button next to the date filter
3. **Select Date Range**:
   - Choose "From" date (start of range)
   - Choose "To" date (end of range)
4. **Click Refresh** to load historical data for the selected range
5. **View Results**:
   - Table shows all teller transactions within the date range
   - Blue badge indicates "Historical View" mode
   - Data includes all supervisors' teller assignments

### For Supervisors:

- Single date mode remains the default
- Can view their assigned tellers' data for any specific date
- Date range functionality only available to SuperAdmins

## Technical Details

### Date Handling
- All dates are handled in Asia/Manila timezone (set via Luxon)
- Date format: YYYY-MM-DD
- Date range queries include both start date (00:00:00) and end date (23:59:59)
- Proper UTC conversion for database queries

### Backward Compatibility
- Existing code using `dateKey` parameter continues to work
- Single date mode works as before
- No breaking changes to existing endpoints

### Performance Considerations
- Database queries optimized for date range filtering
- Transaction queries use `createdAt` with UTC conversion
- Capital records fetched separately (not date-dependent)

## Database Queries

### Date Range Queries
```javascript
// For date range: startDate = "2024-01-01", endDate = "2024-01-31"
createdAt: { 
  $gte: DateTime.fromFormat("2024-01-01", 'yyyy-MM-dd').startOf('day').toUTC(),
  $lt: DateTime.fromFormat("2024-01-31", 'yyyy-MM-dd').plus({days: 1}).startOf('day').toUTC()
}
```

## UI Enhancements

### Date Filter Display
- **Single Date Mode**: Yellow/amber badge showing selected date
- **Date Range Mode**: Blue badge showing "Historical View: [StartDate] - [EndDate]"

### Toggle Buttons
- **Range Button** (appears in single date mode): Switch to date range mode
- **Single Button** (appears in date range mode): Switch back to single date mode

## Example Workflow

```
SuperAdmin User Login
  ↓
Navigate to Capital Management
  ↓
Click "📅 Range" button
  ↓
Select Start Date: 2024-01-01
Select End Date: 2024-01-31
  ↓
Click Refresh
  ↓
API Call: GET /api/admin/teller-overview?startDate=2024-01-01&endDate=2024-01-31
  ↓
View all teller transactions for January 2024
```

## Security Notes

- Date range filtering available only to SuperAdmins
- Supervisors can still view historical data for their assigned tellers using single date mode
- No sensitive data exposed beyond what users have access to

## Future Enhancements

1. Add preset date ranges (Last 7 days, Last Month, Last Year)
2. Add date range picker calendar widget
3. Export historical data to CSV/Excel
4. Add transaction filtering and search within date range
5. Add charting/visualization for historical trends

## Commit Information

- **Commit Hash**: 1708d48
- **Feature**: Historical teller management data access with date range filtering
- **Files Modified**:
  - frontend/src/pages/TellerManagement.jsx
  - backend/routes/teller-management.js
  - backend/routes/adminTellerOverview.js
- **Build Status**: ✅ Passed

## Testing Checklist

- [ ] SuperAdmin can toggle between single date and date range modes
- [ ] Date range queries return data for all days in range
- [ ] Single date mode still works as before
- [ ] Supervisor views are not affected
- [ ] Historical data accurately reflects transactions from specified dates
- [ ] UI properly displays date range indicators
- [ ] API endpoints handle both query parameter types
- [ ] No database errors with date range queries
