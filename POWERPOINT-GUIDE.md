# PowerPoint to Video Guide

## 🎬 Simple Approach: Manual Conversion

The easiest and most reliable way to display PowerPoint presentations with transitions is to convert them to MP4 video **before uploading**.

## ✅ Why This Works Better

- ✅ **No server dependencies** - No PowerPoint required on server
- ✅ **Preview before upload** - See exactly what will display
- ✅ **Better quality control** - Adjust settings per presentation
- ✅ **Faster uploads** - No server-side conversion delay
- ✅ **Cross-platform** - Works on any OS

## 📹 How to Convert PowerPoint to Video

### Method 1: PowerPoint Built-in (Recommended)

**In PowerPoint:**
1. Open your presentation
2. Go to **File** → **Export** → **Create a Video**
3. Choose quality:
   - **Ultra HD (4K)** - 3840 x 2160 (best for large displays)
   - **Full HD (1080p)** - 1920 x 1080 (recommended)
   - **HD (720p)** - 1280 x 720 (smaller file)
4. Set timing:
   - **Use Recorded Timings and Narrations** (if you have them)
   - **Don't Use Recorded Timings** → Set seconds per slide (e.g., 5 seconds)
5. Click **Create Video**
6. Save as `.mp4`

**Result:** Perfect MP4 with all transitions and animations preserved!

### Method 2: Batch Convert Multiple Files

Use the PowerShell script I created earlier:

```powershell
cd "C:\Users\Jimmy.White\source\VSCODE Projects\kiosk\scripts"

.\Convert-PowerPointToVideo.ps1 `
    -InputFolder "C:\Presentations" `
    -OutputFolder "C:\Videos" `
    -Quality 2 `
    -SecondsPerSlide 5
```

This will convert all `.pptx` files in a folder to MP4.

### Method 3: Online Converters (Quick & Easy)

If you don't have PowerPoint installed:
- **CloudConvert** - https://cloudconvert.com/pptx-to-mp4
- **Zamzar** - https://www.zamzar.com/convert/pptx-to-mp4/
- **FreeConvert** - https://www.freeconvert.com/pptx-to-mp4

## 📤 Upload Video to Kiosk

### Option 1: Via Admin Dashboard

1. **Convert your PowerPoint** to MP4 (see above)
2. **Go to Content page** in admin dashboard
3. **Click "Upload Video"** or create new content
4. **Enter URL** or upload video file
5. **Add to playlist**
6. **Assign to device**

### Option 2: Via Direct Upload API

```bash
curl -X POST http://your-server:5001/content/upload/video \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@presentation.mp4" \
  -F "name=My Presentation"
```

### Option 3: Host on Server

1. Copy MP4 to server: `wwwroot/videos/presentation.mp4`
2. Create content with URL: `http://your-server:5001/videos/presentation.mp4`
3. Add to playlist
4. Assign to device

## 🎯 Best Practices

### Video Settings (PowerPoint Export)

**For best results:**
- **Quality:** 1080p (good balance of quality and file size)
- **Duration:** 5-10 seconds per slide (adjust to content)
- **Format:** MP4 (H.264 codec)
- **Audio:** Enable if you have narration

### File Size Optimization

**Large presentations?**
1. Compress images before adding to PowerPoint
2. Remove unnecessary slides
3. Use 720p instead of 1080p if file too large
4. Keep videos under 200MB for smooth streaming

### Presentation Design Tips

**For digital signage:**
- Use high contrast (easy to read from distance)
- Large fonts (minimum 24pt)
- Simple transitions (avoid overcomplicating)
- Test on actual display before deploying

## 📊 Video Playback in Kiosk

Your kiosk browser supports:
- ✅ MP4 (H.264)
- ✅ WebM
- ✅ Looping (set duration to 0)
- ✅ Autoplay
- ✅ Full-screen display

## 🔧 Troubleshooting

### Video Not Playing

**Check:**
1. File format (must be MP4/WebM)
2. Video codec (H.264 recommended)
3. File permissions (readable by web server)
4. URL is correct and accessible
5. Browser console for errors

### Video Quality Issues

**Solutions:**
1. Re-export at higher resolution
2. Use H.264 codec (best browser support)
3. Increase bitrate in export settings
4. Check display resolution settings

### Large File Size

**Optimize:**
1. Re-export at 720p instead of 1080p
2. Reduce seconds per slide (shorter video)
3. Compress images in PowerPoint before export
4. Use video compression tools (HandBrake, FFmpeg)

## 📋 Quick Reference

### PowerPoint → Kiosk Workflow

```
1. Design presentation in PowerPoint
   ↓
2. File → Export → Create Video
   ↓
3. Choose 1080p, 5 seconds per slide
   ↓
4. Save as presentation.mp4
   ↓
5. Upload to kiosk via admin dashboard
   ↓
6. Add to playlist
   ↓
7. Assign to device
   ↓
8. Video displays with all transitions!
```

## 🎉 Example

**Scenario:** Marketing presentation with 20 slides, 5 seconds each

**Steps:**
1. Open `marketing.pptx` in PowerPoint
2. File → Export → Create Video
3. Select "Full HD (1080p)"
4. Set "5 seconds" per slide
5. Click "Create Video" → Save as `marketing.mp4`
6. Upload to kiosk: Admin Dashboard → Content → Upload Video
7. Add to playlist: "Marketing Loop"
8. Assign to device: "Lobby Display"

**Result:** 100-second video with all transitions, playing in loop on lobby display!

## 💡 Pro Tips

1. **Preview first** - Always watch the exported video before uploading
2. **Name consistently** - Use descriptive names (e.g., "Jan2025-Sales-Deck.mp4")
3. **Version control** - Keep original .pptx files for future edits
4. **Test loop** - Ensure smooth transition from end to beginning
5. **Update regularly** - Refresh content weekly/monthly to keep engaging

## 📞 Need Help?

- PowerPoint export not working? Check Microsoft Office version (2013+)
- Video upload failing? Check file size limits (2.5GB max)
- Video not displaying? Check browser console for errors
- Quality issues? Try different export settings

---

**Note:** The server also has a `/content/upload/pptx` endpoint that converts PowerPoint to static images (no transitions). Use the video approach above if you need transitions!
