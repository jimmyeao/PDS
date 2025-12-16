# WiX Installer Quick Start Guide

## 🚀 Getting Started in 5 Steps

### Step 1: Install Prerequisites

1. **Install WiX Toolset 3.11+**
   ```
   Download: https://github.com/wixtoolset/wix3/releases/latest
   - Download WiX311.exe (WiX Toolset v3.11 or later)
   - Run installer
   - Add to PATH: C:\Program Files (x86)\WiX Toolset v3.11\bin
   ```

2. **Verify WiX Installation**
   ```batch
   candle.exe -?
   ```
   Should display WiX Candle help. If not found, add WiX to PATH.

### Step 2: Install Node Dependencies

```batch
cd C:\Users\Jimmy.White\source\VSCODE Projects\kiosk\client
npm install
```

This installs `node-windows` package required for service generation.

### Step 3: Generate Placeholder Images

```batch
cd installer
powershell -ExecutionPolicy Bypass -File create-placeholder-images.ps1
```

Creates `banner.bmp` and `dialog.bmp` for the installer UI.

### Step 4: Build the MSI

```batch
cd installer
build.bat
```

**Build Process (10 steps, ~5-10 minutes):**
1. ✓ Check prerequisites (WiX tools)
2. ✓ Build TypeScript client
3. ✓ Install production dependencies
4. ✓ Generate service configuration
5. ✓ Download Node.js v20 portable (~50MB)
6. ✓ Generate placeholder images
7. ✓ Harvest files with Heat.exe
8. ✓ Compile WiX sources with Candle
9. ✓ Link MSI with Light
10. ✓ Cleanup intermediate files

**Output:** `KioskClient-v1.0.0.0.msi` (~70-100MB)

### Step 5: Test the Installer

**Interactive Installation:**
```batch
KioskClient-v1.0.0.0.msi
```

Fill in the configuration dialog:
- **Server URL:** http://your-server:5001
- **Device Token:** (from admin dashboard)
- **Display:** 1920x1080
- **Kiosk Mode:** ✓ Enabled

**Silent Installation (Intune):**
```batch
msiexec /i KioskClient-v1.0.0.0.msi /qn ^
  SERVER_URL=http://192.168.1.100:5001 ^
  DEVICE_TOKEN=your-device-token ^
  /l*v install.log
```

## ✅ Verification

After installation:

1. **Check Service**
   ```batch
   sc query KioskClient
   ```
   Should show: **STATE: 4 RUNNING**

2. **Check Files**
   ```batch
   dir "C:\Program Files\Kiosk Client"
   ```
   Should show: `app\`, `nodejs\`, `logs\`

3. **Check Configuration**
   ```batch
   notepad "C:\Program Files\Kiosk Client\app\.env"
   ```
   Should contain your SERVER_URL and DEVICE_TOKEN

4. **Check Logs**
   ```batch
   dir "C:\Program Files\Kiosk Client\logs"
   ```

## 🔧 Common Issues

### "candle.exe not found"
**Solution:** Install WiX Toolset and add to PATH

### "TypeScript build failed"
**Solution:** Run `npm install` and `npm run build` in client directory

### "Failed to download Node.js"
**Solution:** Check internet connection or manually download and extract to `installer/nodejs/`

### "Service fails to start"
**Solution:** Check logs, verify .env configuration, ensure server is reachable

## 📦 Intune Deployment

1. **Upload MSI to Intune**
   - Apps > All apps > Add > Line-of-business app
   - Upload `KioskClient-v1.0.0.0.msi`

2. **Install Command**
   ```
   msiexec /i KioskClient-v1.0.0.0.msi /qn SERVER_URL=http://server:5001 DEVICE_TOKEN=token /l*v C:\Windows\Temp\install.log
   ```

3. **Uninstall Command**
   ```
   msiexec /x {8F5E3D2A-9B7C-4F1E-A3D6-2C9B8E7F4A1B} /qn
   ```

4. **Detection Rule**
   - File: `C:\Program Files\Kiosk Client\app\dist\index.js` exists

5. **Requirements**
   - Windows 10 1607+ or Windows 11
   - x64 architecture
   - 500MB free disk space

## 🔄 Updates

To build a new version:

```batch
cd installer
build.bat 1.0.1
```

Install over existing version (preserves configuration):
```batch
msiexec /i KioskClient-v1.0.1.0.msi /qn
```

## 📚 Documentation

- **Full README:** `installer/README.md`
- **Implementation Plan:** `C:\Users\Jimmy.White\.claude\plans\velvety-dazzling-willow.md`
- **WiX Tutorial:** https://www.firegiant.com/wix/tutorial/

## 🎯 Next Steps

1. **Build and test locally** - Verify installation works
2. **Customize branding** - Replace placeholder images with branded designs
3. **Test silent install** - Verify Intune command works
4. **Create test deployment** - Deploy to test device via Intune
5. **Production rollout** - Deploy to all kiosk devices

---

**Questions?** Check `installer/README.md` for detailed troubleshooting and configuration options.
