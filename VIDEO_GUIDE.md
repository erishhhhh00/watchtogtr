# 🎬 Video & Voice Chat Guide

## ✅ FIXED ISSUES

### 1. Video Player Now Supports Multiple Sources
Your video player now works with:
- ✅ **YouTube** videos
- ✅ **Google Drive** videos  
- ✅ **Seedr** videos
- ✅ **Direct video links** (.mp4, .webm, .mkv, etc.)

### 2. Voice Chat Stays Connected
- ✅ Voice chat no longer disconnects automatically
- ✅ Better connection status indicators
- ✅ Shows number of connected participants

---

## 📺 How to Add Videos

### YouTube Videos
**Supported formats:**
```
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
https://www.youtube.com/embed/VIDEO_ID
```

**Example:**
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ
```

### Google Drive Videos
**Supported formats:**
```
https://drive.google.com/file/d/FILE_ID/view
https://drive.google.com/open?id=FILE_ID
```

**Steps:**
1. Upload video to Google Drive
2. Right-click → Share → Anyone with link can view
3. Copy the link
4. Paste in Watch Together

**Example:**
```
https://drive.google.com/file/d/1abc123xyz456/view?usp=sharing
```

### Seedr Videos
**Supported format:**
```
https://www.seedr.cc/files/VIDEO_ID/filename.mp4
```

**Steps:**
1. Upload torrent to Seedr
2. Right-click on video → Copy link
3. Paste in Watch Together

### Direct Video Links
Any direct link to video files:
```
https://example.com/videos/movie.mp4
https://example.com/video.webm
https://example.com/stream.mkv
```

---

## 🎤 How to Use Voice Chat

### Starting Voice Chat
1. **Join a room** (as host or participant)
2. Look for **"🎤 Voice Chat"** panel in the sidebar
3. Click **"Join Voice Chat"** button
4. **Allow microphone access** when browser asks
5. Wait for green indicator: "Voice chat active"

### Voice Chat Controls

**Mute/Unmute:**
- Click the **🔊 Mute** button to mute yourself
- Click **🔇 Unmute** to unmute
- Your microphone status shows in real-time

**Leave Voice:**
- Click **📞 Leave Voice** to disconnect
- Your microphone will be released

### Voice Chat Status Indicators

✅ **Green dot pulsing** = Voice chat is active  
🔊 **Connected with X participants** = You're connected to others  
⏳ **Waiting for participants** = No one else has joined voice yet

### Troubleshooting Voice Chat

**Problem: Microphone access denied**
- Solution: 
  1. Click the 🔒 lock icon in browser address bar
  2. Allow microphone access
  3. Refresh the page
  4. Try joining voice chat again

**Problem: Can't hear others**
- Solution:
  1. Check your system volume
  2. Make sure other participants have joined voice chat
  3. Ask others to unmute their microphones

**Problem: Voice disconnects**
- Solution:
  1. Check your internet connection
  2. Try leaving and rejoining voice chat
  3. Refresh the page if needed

---

## 🎯 Complete Workflow Example

### Example: Watching YouTube with Friends

1. **Create a room**
   - Go to http://localhost:5173
   - Click "Create Room"
   - Name your room (e.g., "Movie Night")

2. **Invite friends**
   - Click "📋 Copy Invite Link"
   - Send link to friends via WhatsApp/Discord/etc.

3. **Add YouTube video**
   - As host, scroll to "Host Controls"
   - Click "+ Add Video URL"
   - Select "YouTube" from dropdown
   - Paste URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - Click "Load Video"
   - Video will load for everyone automatically

4. **Start voice chat**
   - Click "Join Voice Chat" in sidebar
   - Allow microphone access
   - Wait for friends to join voice
   - Now you can talk while watching!

5. **Control playback** (Host only)
   - Click play ▶ on video player
   - Everyone's video syncs automatically
   - Use pause, seek controls
   - Everyone stays synchronized (<500ms drift)

6. **Use text chat**
   - Type messages in "Chat" panel
   - Everyone sees messages instantly
   - Chat history is preserved

---

## 🔧 Technical Details

### Supported Video Formats
- **YouTube**: Uses YouTube IFrame API
- **HTML5 Videos**: MP4, WebM, MKV, OGG
- **Streaming**: HLS streams (m3u8)

### Voice Chat Technology
- **Protocol**: WebRTC peer-to-peer
- **Audio Quality**: 
  - Echo cancellation: ON
  - Noise suppression: ON
  - Auto gain control: ON
- **Latency**: < 100ms typically

### Synchronization
- **Algorithm**: Server-authoritative clock
- **Sync frequency**: Every 5 seconds
- **Drift tolerance**: 500ms
- **Auto-correction**: Yes

---

## 🐛 Common Issues & Solutions

### Video Won't Load

**YouTube videos:**
- ✅ Make sure URL is complete: `https://www.youtube.com/watch?v=...`
- ✅ Check if video is not restricted/private
- ✅ Try a different YouTube video

**Google Drive videos:**
- ✅ Make sure sharing is set to "Anyone with link"
- ✅ File must be a video format (MP4, WebM, etc.)
- ✅ Try downloading and using direct link instead

**Direct links:**
- ✅ URL must end with video extension (.mp4, .webm)
- ✅ Server must allow CORS (cross-origin requests)
- ✅ Try opening link in new tab to verify it works

### Synchronization Issues

**Videos out of sync:**
- ✅ Wait 5 seconds - auto-sync will fix it
- ✅ Host can pause and play to resync everyone
- ✅ Check internet connection quality

**Controls not working:**
- ✅ Only HOST can control playback
- ✅ Participants can only watch
- ✅ Make sure you're the host (created the room)

---

## 📞 Support

If you encounter issues:
1. Check browser console (F12) for errors
2. Check backend terminal for error logs
3. Try refreshing the page
4. Clear browser cache and try again

**Current Status:**
- ✅ Backend: http://localhost:3001
- ✅ Frontend: http://localhost:5173
- ✅ YouTube support: Active
- ✅ Voice chat: Active
- ✅ Synchronization: Active

---

**Enjoy watching together! 🍿🎬**
