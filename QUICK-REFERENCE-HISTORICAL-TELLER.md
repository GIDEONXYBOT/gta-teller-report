# Quick Reference: Historical Teller Management

## What's New?

SuperAdmins can now **view past teller management records** using a date range filter, allowing them to review historical data even after reports have been submitted by tellers.

## Key Capabilities

✅ **View Historical Data**: Access teller management records from any past date  
✅ **Date Range Filtering**: Filter by date range (e.g., Jan 1-31, 2024)  
✅ **All Teller Access**: View management data for all supervisors' tellers  
✅ **Transaction History**: See all capital, additional, and remittance transactions within the date range  
✅ **Backward Compatible**: Single date mode still works as before  

## How to Access

1. Go to **Capital Management** page (TellerManagement)
2. Click **"📅 Range"** button to enable date range mode
3. Select **From** date and **To** date
4. Click **Refresh** to load data
5. View results in blue "Historical View" badge

## API Endpoints

### For Supervisors
```
GET /api/teller-management/tellers
  ?supervisorId=<id>&startDate=2024-01-01&endDate=2024-01-31
```

### For SuperAdmins
```
GET /api/admin/teller-overview
  ?startDate=2024-01-01&endDate=2024-01-31
```

## State Variables (Frontend)

```javascript
startDate     // Start of date range (YYYY-MM-DD)
endDate       // End of date range (YYYY-MM-DD)
showDateRange // Boolean toggle for range mode
selectedDate  // Single date (for single-date mode)
```

## Database Queries

Date ranges are converted to UTC queries with:
- Start: `startOf('day')` on Manila timezone
- End: `plus({ days: 1 }).startOf('day')` on Manila timezone

## Features by Role

| Feature | SuperAdmin | Supervisor | Admin |
|---------|-----------|-----------|-------|
| Single Date View | ✅ | ✅ | ✅ |
| Date Range View | ✅ | ❌ | ✅ |
| View All Tellers | ✅ | ❌ | ✅ |
| View Assigned Tellers | ✅ | ✅ | ✅ |

## UI Indicators

- **Single Date Mode**: Yellow badge showing date
- **Date Range Mode**: Blue badge showing "Historical View: [Start] - [End]"

## Implementation Files

- `frontend/src/pages/TellerManagement.jsx` - UI and logic
- `backend/routes/teller-management.js` - Supervisor endpoint
- `backend/routes/adminTellerOverview.js` - Admin endpoint

## Recent Changes

| Component | Change | Type |
|-----------|--------|------|
| Frontend State | Added startDate, endDate, showDateRange | Addition |
| fetchTellers() | Added date range param handling | Update |
| Date Picker | Added toggle buttons and dual inputs | UI |
| Backend Queries | Added startDate/endDate param support | Update |
| useEffect | Updated dependencies | Update |

## Testing the Feature

1. Login as SuperAdmin
2. Go to Capital Management
3. Click "Range" button
4. Select dates (e.g., last week)
5. Click Refresh
6. Verify data shows for selected range

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Range button not showing | Ensure logged in as SuperAdmin |
| No data in range | Verify dates contain actual transactions |
| Wrong timezone | Check timezone set to Asia/Manila |
| API errors | Check browser console for error details |

## Notes

- Dates are stored and queried in Asia/Manila timezone
- Date format must be YYYY-MM-DD
- End date is inclusive (includes full day)
- Capital records are not date-filtered (shows current active capital)
- Compatible with existing single-date code

---

For full documentation, see: `TELLER-MANAGEMENT-HISTORICAL-VIEW.md`
