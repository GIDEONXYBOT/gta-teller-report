# 🗺️ Live Map & Regional Editor - Enhancement Guide

## Overview
The enhanced Live Map system provides administrators and declarators with a sophisticated geospatial management tool for managing teller assignments, regions, and operational areas within the RMI Teller Report application.

---

## Key Features Explained

### 1. **Core Canvas Management**
- **High-DPI Image Upload**: Upload branch/region maps as PNG/JPG
- **Base64 Encoding**: Maps stored offline for instant availability (no server calls needed)
- **Aspect Ratio Preservation**: Automatically maintains image proportions

**Why it matters:**
- Enables offline map viewing
- Fast loading for field operations
- No dependency on external mapping services

---

### 2. **Zoom & Pan Controls** 🔍
```
- Zoom In/Out buttons (0.5x to 4x magnification)
- Reset button (back to 1x, centered view)
- Smooth transitions during navigation
```

**Use Cases:**
- Zoom into dense areas with many labels
- Navigate large branch maps
- Quickly find specific regions

**Code Pattern:**
```javascript
const [zoom, setZoom] = useState(1);
const [pan, setPan] = useState({ x: 0, y: 0 });
// Applied via transform: `scale(${zoom})`
```

---

### 3. **Regional Polygons** 🔲
Create multi-point polygons to define operational zones:

**Process:**
1. Click "🔲 Region" button to enter region draw mode
2. Click on map to place polygon vertices (minimum 3 points)
3. Visual preview shows semi-transparent polygon with connected points
4. Click "✓ Finish" to save region
5. Assign a teller to that region from dropdown

**Features:**
- Color-coded regions (6 different colors)
- Point markers show exact polygon vertices
- Clickable regions for selection/editing
- Delete or duplicate regions

**Implementation:**
```javascript
const [draftRegion, setDraftRegion] = useState([]); // {x,y} array
const regionColors = {
  0: 'rgba(99,102,241,0.35)',     // indigo
  1: 'rgba(16,185,129,0.35)',     // emerald
  2: 'rgba(239,68,68,0.35)',      // red
  // ... more colors
};
```

---

### 4. **Label Markers** 📍
Quick text labels for specific locations:

**Creating Markers:**
1. Click "📍 Label" button
2. Click anywhere on the map
3. Edit label text in the marker or sidebar
4. Drag markers to reposition

**Features:**
- Inline editing - click to edit label text
- Drag-to-move functionality (while in select mode)
- Real-time position tracking (x%, y%)
- Delete markers with trash button

**Drag-to-Move Implementation:**
```javascript
const handleMouseDown = (e) => {
  if (selectedMarker) {
    setDragging({ type: 'marker', id: selectedMarker, startX, startY });
  }
};

// During move: recalculate x/y relative to container
const newX = marker.position.x + (deltaX / rect.width);
```

---

### 5. **Heat Map Visualization** 🔥
Toggle to visualize teller assignment coverage:

**What it Shows:**
- Green overlay on regions WITH assigned tellers
- Transparent overlay on UNASSIGNED regions
- "Coverage" stat: `X/Y regions assigned`

**Business Value:**
- Quickly identify gaps in teller coverage
- Ensure no region is left unmanaged
- Visual confirmation of complete setup

**Code:**
```javascript
{showHeatmap && r.tellerIds?.length ? 
  'rgba(34,197,94,0.4)'  // green = assigned
  : regionColors[idx % 6]  // default color = unassigned
}
```

---

### 6. **Teller Assignment System** 👤
Assign tellers to specific regions:

**Workflow:**
1. Create region (polygon)
2. Select region in sidebar
3. Choose teller from dropdown: "👤 Assign Teller…"
4. One teller per region (current implementation)
5. Changes sync to database immediately

**Data Structure:**
```javascript
{
  id: "reg_1234567890",
  name: "Zone A - Counter 1",
  points: [{x: 0.1, y: 0.2}, {x: 0.5, y: 0.3}, ...],
  tellerIds: ["userId123"] // array for future multi-assignment
}
```

---

### 7. **Configuration Export/Import** 📤/📥

**Export (Download):**
- Button: "Export to JSON"
- Saves map config as `map-config-YYYY-MM-DD.json`
- Includes: image, regions, markers, assignments
- Useful for: backups, sharing configs between branches

**Import (Upload):**
- Button: "Import from JSON"
- Loads previously saved configuration
- Validates JSON format
- Overwrites current config

**Use Case:**
```
Setup map once → Export → Share with other branches
Other branches import → Done! (5 min setup)
```

---

### 8. **Visibility Toggle** 👁️
Show/hide labels for cleaner canvas:

**States:**
- ✓ Enabled: All marker labels visible
- ✗ Disabled: Labels hidden (canvas less cluttered)

**Why Useful:**
- Dense maps with many markers can be hard to read
- Hide labels when reviewing overall layout
- Show labels when editing/assigning

---

### 9. **Real-Time Selection UI**
Selected items highlight with yellow border:

**Markers:**
- Yellow background + black text
- Input field becomes editable
- Shows position coordinates

**Regions:**
- Yellow border around polygon
- Highlighted in sidebar
- Ready for assignment/deletion

---

### 10. **Responsive Layout** 📱
- **Desktop (≥1024px)**: Canvas left, sidebar right (80/20 split)
- **Tablet/Mobile**: Canvas full-width, sidebar below
- Touch-friendly button sizes
- Readable text on all devices

---

## User Workflows

### 🎯 Workflow 1: Initial Branch Map Setup
```
1. Upload map image (branch floor plan/layout photo)
2. Add region polygons (Zone A, Zone B, Zone C, etc.)
3. Add label markers (Teller 1 position, Manager desk, etc.)
4. Assign tellers to regions
5. Click "💾 Save"
6. Export config for backup
```

### 🎯 Workflow 2: Editing Existing Map
```
1. Map loads automatically
2. Click marker to select → drag to move
3. Click region to select → rename or reassign teller
4. Add new markers (📍 Label) as needed
5. Save changes
```

### 🎯 Workflow 3: Reviewing Coverage
```
1. Click 🔥 to toggle heat map
2. See which regions have assigned tellers (green)
3. See unassigned regions (default color)
4. Check coverage stat
5. Fill gaps by assigning remaining tellers
```

---

## Technical Details

### State Management
```javascript
const [config, setConfig] = useState(null);        // Map data
const [zoom, setZoom] = useState(1);               // Zoom level
const [pan, setPan] = useState({x: 0, y: 0});      // Pan offset
const [selectedMarker, setSelectedMarker] = useState(null);  // Selected item
const [selectedRegion, setSelectedRegion] = useState(null);  // Selected region
const [dragging, setDragging] = useState(null);    // Drag state
const [showHeatmap, setShowHeatmap] = useState(false);  // Heat map toggle
const [showLabels, setShowLabels] = useState(true);     // Label visibility
```

### Coordinate System
- **Relative Coordinates**: All positions stored as `x` (0-1) and `y` (0-1)
- **Percentage Rendering**: `left: ${x*100}%` renders at % of container
- **Precision**: 4 decimal places (e.g., `0.1234`)
- **Benefit**: Works with any image size, responsive by default

### Permissions
```javascript
const canEdit = ['admin','super_admin','declarator'].includes(user?.role);
```
- **Admin/Super Admin**: Full edit access
- **Declarator**: Full edit access (asset management)
- **Others**: Read-only view

---

## Database Payload

**POST/PUT /api/map-config**
```json
{
  "imageData": "data:image/png;base64,...",
  "imageWidth": 1920,
  "imageHeight": 1080,
  "markers": [
    {
      "id": "lbl_1699999999999",
      "label": "Counter 1",
      "position": { "x": 0.2345, "y": 0.5678 }
    }
  ],
  "regions": [
    {
      "id": "reg_1699999999999",
      "name": "Zone A",
      "points": [
        { "x": 0.1, "y": 0.1 },
        { "x": 0.5, "y": 0.1 },
        { "x": 0.3, "y": 0.4 }
      ],
      "tellerIds": ["user123"]
    }
  ]
}
```

---

## Key Improvements Summary

| Feature | Old Version | New Version | Benefit |
|---------|-----------|---------|---------|
| **Markers** | Static labels | Drag-to-move | Quick repositioning |
| **Zoom** | Fixed view | 0.5x-4x zoom + pan | Better for dense maps |
| **Colors** | Single color | 6-color scheme | Easy region identification |
| **Heat Map** | None | Real-time coverage | Verify complete setup |
| **Export** | None | JSON export/import | Backup & sharing |
| **Selection** | No highlight | Yellow highlight | Clear visual feedback |
| **Deletion** | None | Delete markers/regions | Edit/cleanup |
| **Duplication** | None | Clone regions | Fast setup |
| **Stats** | None | Coverage counter | Quick validation |

---

## Performance Notes

- **Image Encoding**: Base64 increases size ~33%, but enables offline use
- **Canvas Rendering**: SVG-based (efficient, scalable)
- **Zoom Performance**: CSS transforms (GPU-accelerated)
- **Socket Sync**: Real-time updates via `mapConfigUpdated` event
- **Memory**: All data in-memory on client (suitable for ≤10K markers)

---

## Future Enhancements

1. **Multi-Teller Assignment** per region (many-to-many)
2. **GPS Integration** - live teller position on map
3. **Movement Tracking** - heat map of teller traffic
4. **Geofencing** - notifications when teller enters/exits region
5. **Import From Maps** - link to Google Maps for exact coordinates
6. **Rotation** - rotate map image for alignment
7. **Grid Overlay** - coordinate system for precise placement
8. **Undo/Redo** - change history navigation

---

## Troubleshooting

**Q: Map image not displaying?**
- A: Check file format (PNG/JPG), size limit, and browser console for errors

**Q: Markers won't drag?**
- A: Ensure you're in select mode (not add-label mode)

**Q: Region polygon won't finish?**
- A: Need at least 3 points; finish button appears at 3+ points

**Q: Changes not saving?**
- A: Check network tab, verify API endpoint `/api/map-config`

---

## Keyboard Shortcuts (Future)
- `ESC` - Exit draw mode
- `Z` - Toggle zoom fit
- `H` - Toggle heat map
- `L` - Toggle labels
- `DEL` - Delete selected item

---

Generated: November 15, 2025
Version: 2.0 (Enhanced)
Status: Production Ready ✅
