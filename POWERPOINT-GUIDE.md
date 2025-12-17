# PowerPoint Upload & Auto-Conversion Guide

## 🎬 Overview

Your kiosk system now **automatically converts PowerPoint presentations to video** when you upload them, preserving all transitions, animations, and effects!

## ✨ Features

- ✅ **Automatic conversion** - Upload `.pptx`, get video instantly
- ✅ **Preserves transitions** - All animations and effects work perfectly
- ✅ **1080p quality** - High-definition output
- ✅ **Configurable timing** - Set seconds per slide
- ✅ **Fallback support** - Falls back to image slideshow if PowerPoint unavailable

## 📤 How to Upload PowerPoint

### Option 1: Via Admin Dashboard (Recommended)

1. **Go to Content page** in admin dashboard
2. **Click "Upload PowerPoint"** button
3. **Select your .pptx file**
4. **Enter name** for the content
5. **Set duration per slide** (e.g., 5000 = 5 seconds)
6. **Click Upload**
7. Wait for conversion (usually 1-2 minutes)
8. **Video automatically created** and ready to use!

### Option 2: Via API (For Developers)

**Endpoint:** `POST /content/upload/pptx`

**Request:**
```bash
curl -X POST http://your-server:5001/content/upload/pptx \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@presentation.pptx" \
  -F "name=My Presentation" \
  -F "durationPerSlide=5000"
```

**Parameters:**
- `file` (required): PowerPoint file (.pptx)
- `name` (required): Content name
- `durationPerSlide` (optional): Milliseconds per slide (default: 10000 = 10s)

**Response:**
```json
{
  "id": 123,
  "name": "My Presentation",
  "url": "/videos/My Presentation.mp4",
  "defaultDuration": 0,
  "createdAt": "2025-12-17T12:00:00Z"
}
```

## 🎯 How It Works

```
PowerPoint Upload (.pptx)
        ↓
Backend Server
        ↓
PowerPoint COM Automation
        ↓
MP4 Video (1080p)
        ↓
Saved to wwwroot/videos/
        ↓
Content Created with Video URL
        ↓
Add to Playlist
        ↓
Kiosk Displays Video in Browser
```

## ⚙️ Configuration

### Conversion Settings

Edit `SlideshowService.cs` to change default settings:

```csharp
var videoPath = await _pptConverter.ConvertToVideoAsync(
    file.OpenReadStream(),
    file.FileName,
    videosDir,
    quality: 2,              // 1=720p, 2=1080p, 3=4K
    secondsPerSlide: 5);     // Seconds per slide
```

### Video Storage

Videos are stored in: `wwwroot/videos/`
URL format: `http://your-server:5001/videos/filename.mp4`

## 📋 Requirements

### Server Requirements

**Windows Server:**
- ✅ **Microsoft PowerPoint** must be installed
- ✅ PowerPoint must be licensed
- ✅ .NET 8.0 Runtime

**Linux Server:**
- ❌ PowerPoint COM not available
- ✅ Falls back to image slideshow (PDF → Images)
- ❌ Transitions lost in fallback mode

### PowerPoint Compatibility

- ✅ `.pptx` files (PowerPoint 2007+)
- ✅ `.ppt` files (PowerPoint 97-2003) - may have compatibility issues
- ✅ Embedded videos - included in output
- ✅ Animations - preserved
- ✅ Transitions - preserved
- ✅ Audio - preserved (if enabled)

## 🚀 Quick Start

### 1. Install Backend Updates

```bash
cd src/PDS.Api

# Restore NuGet packages (includes Microsoft.Office.Interop.PowerPoint)
dotnet restore

# Build
dotnet build

# Run
dotnet run
```

### 2. Create Videos Directory

```bash
# Backend will create this automatically, but you can pre-create it:
mkdir -p src/PDS.Api/wwwroot/videos
```

### 3. Upload Your First PowerPoint

1. Open admin dashboard: `http://your-server:5001`
2. Login
3. Navigate to **Content**
4. Click **Upload PowerPoint**
5. Select your `.pptx` file
6. Enter name and duration
7. Upload!

### 4. Add to Playlist

1. Go to **Playlists**
2. Create new playlist or edit existing
3. **Add content** → Select your video
4. Set display duration (0 = play full video)
5. **Assign to device**

## 🎥 Video Examples

### Example 1: Simple Presentation (10 slides, 5 seconds each)

```
Input:  presentation.pptx (5 MB)
Output: presentation.mp4 (25 MB, 1920x1080, 50 seconds)
Time:   ~1 minute to convert
```

### Example 2: Complex Presentation (50 slides, animations)

```
Input:  marketing.pptx (15 MB)
Output: marketing.mp4 (120 MB, 1920x1080, 4 minutes)
Time:   ~3-5 minutes to convert
```

## 🔧 Troubleshooting

### "PowerPoint conversion failed"

**Cause:** PowerPoint not installed or not accessible

**Solutions:**
1. Install Microsoft PowerPoint on server
2. Ensure PowerPoint is activated/licensed
3. Run backend as user with PowerPoint access
4. Check server logs for detailed error

**Fallback:** System will use image slideshow (no transitions)

### "Conversion timed out"

**Cause:** Large presentation or slow server

**Solutions:**
1. Reduce slide count
2. Remove large embedded videos/images
3. Increase timeout in `PowerPointConverter.cs`:
   ```csharp
   var timeout = TimeSpan.FromMinutes(60); // Increase to 60 minutes
   ```

### "COM Exception"

**Cause:** PowerPoint COM automation issue

**Solutions:**
1. Close all PowerPoint instances on server
2. Restart server
3. Check DCOM permissions
4. Run as interactive user (not SYSTEM)

### Video Not Playing

**Causes:**
- Browser doesn't support MP4/H.264
- File permissions incorrect
- URL path wrong

**Solutions:**
1. Check browser console for errors
2. Verify video file exists: `wwwroot/videos/filename.mp4`
3. Test video URL directly: `http://server:5001/videos/filename.mp4`
4. Check file permissions (IIS user needs read access)

## 📊 Performance Tips

### Optimize Presentation Before Upload

1. **Compress images** - Reduce file size
2. **Limit embedded videos** - Use external video URLs instead
3. **Simplify animations** - Fewer animations = faster conversion
4. **Remove hidden slides** - They still get converted

### Server Optimization

1. **Use SSD storage** - Faster I/O for video encoding
2. **More RAM** - PowerPoint uses significant memory
3. **Dedicate CPU cores** - Conversion is CPU-intensive

## 🔒 Security Considerations

### File Upload Security

- ✅ **Authentication required** - Only authenticated admins can upload
- ✅ **File type validation** - Only `.pptx` and `.ppt` allowed
- ✅ **Size limits** - 2.5GB max (configurable)
- ✅ **Virus scanning** - Consider adding antivirus scan before conversion

### COM Security

- ⚠️ **PowerPoint COM runs with server privileges**
- ⚠️ **Malicious macros** could execute
- 🔧 **Recommendation:** Disable macros in PowerPoint trust center
- 🔧 **Recommendation:** Use separate conversion server

## 📈 Advanced Usage

### Batch Conversion Script

Use the provided PowerShell script for batch local conversion:

```powershell
.\scripts\Convert-PowerPointToVideo.ps1 `
    -InputFolder "C:\Presentations" `
    -Quality 2 `
    -SecondsPerSlide 5
```

### Custom Video Settings

Modify `PowerPointConverter.cs` for custom settings:

```csharp
presentation.CreateVideo(
    outputPath,
    UseTimingsAndNarrations: true,    // Use recorded timings
    VertResolution: 3,                // 4K quality
    FramesPerSecond: 60,              // Smooth 60fps
    DefaultSlideDuration: 10,         // 10 seconds per slide
    Quality: 100);                    // Maximum quality
```

## 📝 API Reference

### Upload Endpoint

```
POST /content/upload/pptx
Authorization: Bearer {token}
Content-Type: multipart/form-data

Form Fields:
  - file: PowerPoint file
  - name: Content name
  - durationPerSlide: Milliseconds per slide (default: 10000)

Response:
  - 200 OK: Content created with video URL
  - 400 Bad Request: Invalid file or parameters
  - 401 Unauthorized: Missing or invalid token
  - 500 Internal Server Error: Conversion failed
```

## 🎉 Success Checklist

- [x] PowerPoint installed on server
- [x] NuGet packages restored
- [x] Backend running
- [x] Admin dashboard accessible
- [x] Test upload successful
- [x] Video plays in browser
- [x] Content added to playlist
- [x] Kiosk displays video correctly

## 📞 Support

**Issues?**
- Check backend logs: `src/PDS.Api/logs/`
- Check browser console for video playback errors
- Verify PowerPoint installation: `Get-Package -Name "Microsoft Office*"`

**Need Help?**
- See `CLAUDE.md` for general system documentation
- See `bug.md` for troubleshooting installer issues
- Check server logs for detailed error messages
