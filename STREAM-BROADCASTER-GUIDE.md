# Stream Camera Broadcaster Guide

## Overview
The **Stream Camera Broadcaster** feature allows you to broadcast a live camera feed from your Android phone (or any device) to other devices on your network or via QR code sharing.

## Features

### ✅ Broadcaster (Phone)
- **Live Camera Feed**: Capture real-time video from your device camera
- **Broadcast ID**: Unique code generated for each broadcast session
- **QR Code**: Share broadcast instantly via QR code
- **Quality Settings**: Low/Medium/High with automatic frame optimization
- **Performance**: Optimized frame resolution and compression for fast startup

### ✅ Viewer (Laptop/Desktop/Tablet)
- **Real-time Viewing**: Watch live camera feed from broadcaster
- **Auto-Join**: Use `?broadcast=CODE` URL parameter to auto-detect
- **QR Scanning**: Scan QR code to automatically join broadcast
- **Manual Entry**: Enter broadcast ID to join manually
- **Local Fallback**: Works in local mode when backend unavailable

## How to Use

### Starting a Broadcast (Phone)

1. Navigate to **Stream Camera Broadcaster** in the sidebar
2. Click on **"📱 Broadcast Camera"** card
3. Select your camera from the dropdown
4. Choose quality setting:
   - **High**: Best quality, 100ms frames (needs good bandwidth)
   - **Medium**: Balanced (150ms frames)
   - **Low**: Fastest startup (300ms frames)
5. Click **"Start Broadcasting"**
6. Share the **Broadcast ID** or **QR Code** with viewers

### Watching a Broadcast (Viewer Device)

**Option 1: Scan QR Code**
1. Navigate to Stream Camera Broadcaster
2. Click on **"🖥️ Watch Stream"** card
3. Scan the QR code from broadcaster's phone

**Option 2: Enter Broadcast ID**
1. Navigate to Stream Camera Broadcaster
2. Click on **"🖥️ Watch Stream"** card
3. Enter the Broadcast ID displayed on broadcaster
4. Click **"Join Broadcast"**

**Option 3: Auto-Join via URL**
1. Broadcaster shares a link like: `https://www.rmi.gideonbot.xyz/stream-broadcaster?broadcast=A40J2L46QRB`
2. Simply click the link to auto-join

## Mode of Operation

### ✅ Backend WebSocket (Primary - When Available)
- Broadcaster sends frames to backend server
- Backend relays frames to all connected viewers
- Works across networks (WiFi, 4G, etc.)
- **Status**: Currently unavailable (backend returns 500 error)

### ✅ Local Fallback Mode (Current - When Backend Unavailable)
- Broadcaster stores frames in browser session storage
- Viewers poll session storage for new frames
- **Requirements**: Devices must be on the same network/browser session
- **Workaround**: Currently active due to backend endpoint limitation
- **Performance**: Still optimized with reduced resolution and compression

## Technical Details

### Frame Optimization
Frames are automatically optimized based on quality setting:

| Quality | Resolution Scale | JPEG Quality | Frame Interval |
|---------|-----------------|--------------|-----------------|
| High    | 1.0x            | 0.8          | 100ms           |
| Medium  | 0.75x           | 0.6          | 150ms           |
| Low     | 0.5x            | 0.4          | 300ms           |

### Frame Size Examples
- HD (1280x720):
  - High: 922KB → ~185KB (JPEG)
  - Medium: 519KB → ~104KB (JPEG)
  - Low: 230KB → ~46KB (JPEG)

### Connection Flow
```
Phone Camera → Canvas → JPEG Compression → Base64
                                              ↓
                                        WebSocket (if available)
                                        OR Session Storage (fallback)
                                              ↓
                                        Viewer Browser → Display
```

## Status Indicators

### Broadcaster
- 🔴 **BROADCASTING** (red pulsing): Active broadcast
- 🟢 **Connected**: Backend server connected
- 📡 **Broadcasting in local mode**: Using fallback
- ⚠️ **Connecting**: Initializing broadcast

### Viewer
- 🟢 **LIVE** (green pulsing): Receiving frames
- ⚠️ **Waiting for stream**: Connected but no frames yet
- 📡 **Using local fallback mode**: Backend unavailable warning

## Known Limitations

### Current
- ❌ Backend WebSocket endpoint not implemented (returns 500 error)
- ⚠️ Fallback mode requires same network/browser session
- ⚠️ Frame rate depends on network speed and device performance

### Future Enhancements
- [ ] Implement backend `/ws/camera/{id}` endpoint
- [ ] Cross-network broadcasting support
- [ ] Recording functionality
- [ ] Multiple viewer support
- [ ] Audio support
- [ ] Screen sharing

## Troubleshooting

### "Waiting for stream..."
- Check broadcaster is in same network
- Verify broadcaster device has camera selected
- Try refreshing viewer page

### Black screen on broadcaster
- Grant camera permissions
- Try selecting different camera
- Check browser console for errors

### Frames not showing on viewer
- Ensure broadcaster is in "BROADCASTING" mode
- Check both devices are on same network (for local mode)
- Try using QR code auto-join instead of manual ID

### Slow startup
- Try **Low** quality setting
- Check network connection speed
- Close other bandwidth-heavy apps

## Performance Tips

1. **For Fastest Startup**: Use "Low" quality setting
2. **For Better Quality**: Use "High" quality (requires good connection)
3. **For Balanced**: Use "Medium" quality (recommended)
4. **On Slow Networks**: Lower quality + reduce other apps
5. **For Multiple Viewers**: Use separate broadcast for each, or rely on backend once available

## API Integration (For Developers)

### WebSocket Expected Endpoint
```
wss://rmi-backend-zhdr.onrender.com/ws/camera/{broadcastId}
```

### Message Format
```json
{
  "type": "frame",
  "data": "base64_jpeg_image_data",
  "timestamp": 1234567890,
  "broadcastId": "A40J2L46QRB",
  "quality": "medium"
}
```

### Backend Implementation Needed
The backend needs to:
1. Accept WebSocket connections at `/ws/camera/{id}`
2. Store broadcaster connection
3. Relay frame messages to all connected viewers
4. Handle connection cleanup on disconnect

## Security Notes

- Broadcast IDs are randomly generated (10 characters)
- URLs can be shared publicly - anyone with the code can view
- Frames are transmitted in plain base64 (not encrypted in local mode)
- For production: Consider adding encryption/authentication

## Version History

- **v1.0.0**: Initial release with QR code and local fallback
- Optimizations: Frame resolution scaling, JPEG compression, fast intervals
- Auto-detection: URL parameter support for seamless joining

