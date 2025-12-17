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