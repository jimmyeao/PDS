# Installation Issues - RESOLVED

## Original Issues

### 1. NPM Path Error (ENOENT)
**Error:**
```
node.exe : npm error code ENOENT
At Install.ps1:169 char:1
+ & $NodeExe "$NodePath\node_modules\npm\bin\npm-cli.js" --prefix $AppP ...
```

**Root Cause:**
- Script was trying to use incorrect npm path: `$NodePath\node_modules\npm\bin\npm-cli.js`
- Node.js standalone includes `npm.cmd` and `npx.cmd` in the root directory, not in `node_modules\npm\bin\`

**Fix:**
- Updated Install.ps1 to use correct paths: `$NodePath\npm.cmd` and `$NodePath\npx.cmd`

### 2. Service Exits with Return Code 1
**Error:**
```
Program C:\Program Files\Kiosk Client\nodejs\node.exe for service KioskClient exited with return code 1.
```

**Root Cause:**
- Puppeteer Chrome browser was not being installed (lines were commented out)
- When the Kiosk client started, Puppeteer tried to launch Chromium but couldn't find it
- Application crashed immediately, causing service to fail

**Fix:**
- Fixed npm/npx paths to properly install Puppeteer Chrome
- Added detection for existing Google Chrome installation
- If Chrome is found, use it instead of downloading Puppeteer's Chromium
- Automatically sets `PUPPETEER_EXECUTABLE_PATH` in .env configuration

## Solution Summary

### Changes Made to Install.ps1:

1. **Fixed npm/npx paths** (Step 5.5):
   - Changed from: `$NodeExe "$NodePath\node_modules\npm\bin\npm-cli.js"`
   - Changed to: `$NodePath\npm.cmd`

2. **Added Chrome detection** (Step 5.5):
   - Checks for existing Chrome in:
     - `C:\Program Files\Google\Chrome\Application\chrome.exe`
     - `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
     - `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`
   - If found, skips Puppeteer Chrome download
   - If not found, installs Puppeteer Chrome using corrected npm/npx paths

3. **Automatic Chrome path configuration** (Step 6):
   - Detects installed Chrome path
   - Writes path to `PUPPETEER_EXECUTABLE_PATH` in .env file
   - Client automatically uses detected Chrome instead of Chromium

### Benefits:

✅ **Faster installation** - Uses existing Chrome if available (no 100MB+ download)
✅ **More reliable** - Existing Chrome installations are typically more stable
✅ **Fallback support** - Still downloads Puppeteer Chrome if no Chrome found
✅ **Better error handling** - Clear messages if something goes wrong

### Testing:

To test the updated installer:

```powershell
# Clean install test
.\Uninstall.ps1
.\Install.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceToken "your-token"

# Check service status
Get-Service KioskClient

# View logs
Get-Content "C:\Program Files\Kiosk Client\logs\service-out.log" -Tail 20

# Check configuration
Get-Content "C:\Program Files\Kiosk Client\app\.env"
```

### Expected Output:

With Chrome already installed:
```
[5.5/9] Checking for Chrome browser...
  [OK] Found existing Chrome: C:\Program Files\Google\Chrome\Application\chrome.exe
  [OK] Will use existing Chrome instead of downloading Chromium

[6/9] Creating configuration file...
  [OK] Found existing Chrome: C:\Program Files\Google\Chrome\Application\chrome.exe
  [OK] Configuration saved to: C:\Program Files\Kiosk Client\app\.env
```

Without Chrome:
```
[5.5/9] Checking for Chrome browser...
  [!] No Chrome installation found, installing Puppeteer Chrome...
  [...] Verifying dependencies...
  [...] Downloading Chromium browser (this may take several minutes)...
  [OK] Puppeteer Chrome installed successfully
```

---

## New Issue: Browser Not Visible (Session 0 Isolation)

### Problem:
- ✅ Service installs and runs successfully
- ✅ Client connects to backend
- ✅ Remote control works through admin dashboard
- ❌ Browser window is not visible on the physical screen

### Root Cause:
Windows services run in **Session 0** (isolated system session), not in the interactive desktop session (Session 1+). This is a Windows security feature that prevents services from displaying UI on the user's desktop.

The browser IS running, but in Session 0, so:
- Screenshots work (captured from Puppeteer)
- Remote control works (commands sent to Puppeteer)
- Browser is NOT visible on the physical screen

### Solutions:

#### Option 1: Use Remote Control (Recommended for Remote Kiosks)
**Best for:** Headless kiosks, remote displays, or when physical visibility isn't required

- Browser runs in Session 0
- Use admin dashboard remote control to interact
- Live streaming and visual remote control work perfectly
- No changes needed

#### Option 2: Enable Desktop Interaction (Updated Install.ps1)
**Best for:** Local testing, single-user kiosks

The updated Install.ps1 now configures `SERVICE_INTERACTIVE_PROCESS` to allow desktop interaction.

**Note:** This feature is deprecated in Windows 10/11 and may not work reliably.

**To apply to existing installation:**
```powershell
.\Fix-ServiceDisplay.ps1
```

#### Option 3: Install as Startup Program (NEW: Install-Startup.ps1)
**Best for:** Kiosks that need visible browser window, single-user systems

Installs as a startup program instead of a Windows service:

```powershell
# If service version is installed, uninstall it first
.\Uninstall.ps1

# Install as startup program
.\Install-Startup.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceToken "your-token"

# Or convert existing service installation
.\Install-Startup.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceToken "your-token"
# (will prompt to remove service automatically)
```

**Startup Program Benefits:**
- ✅ Browser window visible on desktop
- ✅ Runs in user session (Session 1+)
- ✅ Starts automatically on user login
- ✅ Easy to manage (stop/start from task manager)

**Startup Program Considerations:**
- ⚠️ Requires user to be logged in
- ⚠️ Won't start until user logs in
- ⚠️ User can close the window (use kiosk mode to prevent)

### Recommendation by Use Case:

| Use Case | Recommended Solution |
|----------|---------------------|
| Remote/headless kiosk | **Option 1** - Use remote control |
| Public kiosk (24/7 display) | **Option 3** - Startup program with auto-login |
| Testing/development | **Option 3** - Startup program |
| Multiple concurrent users | **Option 2** - Service (with remote control) |
| Single dedicated kiosk user | **Option 3** - Startup program |

### Files Added:
1. **Fix-ServiceDisplay.ps1** - Attempts to enable desktop interaction for existing service
2. **Install-Startup.ps1** - Alternative installer that creates startup program instead of service