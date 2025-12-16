# Kiosk Client Windows Installer

Professional MSI installer for deploying the Kiosk Digital Signage client via Microsoft Intune or manual installation.

## Features

- ✅ **Bundles Node.js runtime** - No external dependencies required
- ✅ **Windows Service installation** - Automatic startup and restart on failure
- ✅ **Interactive configuration UI** - User-friendly dialog for SERVER_URL and DEVICE_TOKEN
- ✅ **Silent installation support** - Perfect for Intune deployment with command-line parameters
- ✅ **In-place upgrades** - Preserves configuration during updates
- ✅ **Start menu shortcuts** - Quick access to configuration and logs
- ✅ **Professional installer experience** - Custom branding with banner and dialog images

## Prerequisites

### Required Software

1. **WiX Toolset 3.11 or later**
   - Download: https://github.com/wixtoolset/wix3/releases
   - Install and add to PATH: `C:\Program Files (x86)\WiX Toolset v3.11\bin`
   - Verify: `candle.exe -?` should display help

2. **Node.js 18+** (for building the client)
   - Download: https://nodejs.org/
   - Only needed for building, not for deployment

3. **PowerShell** (for image generation)
   - Pre-installed on Windows 10/11

### System Requirements

- **OS:** Windows 10 or Windows 11 (64-bit only)
- **RAM:** 4GB minimum, 8GB recommended
- **Disk:** 500MB free space
- **Network:** Internet connection for initial Chromium download

## Quick Start

### 1. Build the Installer

```batch
cd client/installer
build.bat
```

This will:
1. Build the TypeScript client
2. Install production dependencies
3. Download Node.js portable (v20 LTS)
4. Generate placeholder images
5. Harvest files with WiX Heat
6. Compile and link the MSI

**Output:** `KioskClient-v1.0.0.0.msi` (~70-100MB)

### 2. Test Interactive Installation

Double-click `KioskClient-v1.0.0.0.msi` and follow the wizard:

1. **Welcome** - Click Next
2. **License Agreement** - Accept and click Next
3. **Configuration** - Enter:
   - Server URL: `http://your-server:5001`
   - Device Token: (obtain from admin dashboard)
   - Display settings: Default 1920x1080
4. **Ready to Install** - Click Install
5. **Completion** - Click Finish

### 3. Verify Installation

- **Service Status:** Open `services.msc` and verify **Kiosk Digital Signage Client** is running
- **Files:** Check `C:\Program Files\Kiosk Client\`
- **Configuration:** Open `C:\Program Files\Kiosk Client\app\.env`
- **Logs:** Check `C:\Program Files\Kiosk Client\logs\`

### 4. Uninstall

- Via **Add/Remove Programs**: Search for "Kiosk Digital Signage Client"
- Via **MSI**: `msiexec /x {PRODUCT-GUID} /qn`
- Via **Start Menu**: "Uninstall Kiosk Client" shortcut

## Silent Installation (Intune Deployment)

### Command

```batch
msiexec /i KioskClient-v1.0.0.0.msi /qn ^
  SERVER_URL=http://your-server:5001 ^
  DEVICE_TOKEN=your-device-token-here ^
  DISPLAY_WIDTH=1920 ^
  DISPLAY_HEIGHT=1080 ^
  KIOSK_MODE=true ^
  LOG_LEVEL=info ^
  /l*v C:\Windows\Temp\KioskClient-install.log
```

### Required Properties

- **SERVER_URL** (required) - Must start with `http://` or `https://`
- **DEVICE_TOKEN** (required) - Non-empty authentication token

### Optional Properties

- **DISPLAY_WIDTH** (default: 1920)
- **DISPLAY_HEIGHT** (default: 1080)
- **KIOSK_MODE** (default: true)
- **LOG_LEVEL** (default: info) - Options: debug, info, warn, error

### Validation

If required properties are missing during silent install, the installer will **fail with error code 1603** and log an error message.

## Intune Configuration

### 1. Upload MSI to Intune

1. Sign in to **Microsoft Endpoint Manager** (https://endpoint.microsoft.com/)
2. Navigate to **Apps** > **All apps** > **Add**
3. Select **Line-of-business app**
4. Upload `KioskClient-v1.0.0.0.msi`

### 2. Configure Installation

**Install command:**
```batch
msiexec /i KioskClient-v1.0.0.0.msi /qn SERVER_URL=http://your-server:5001 DEVICE_TOKEN=%DEVICE_TOKEN% /l*v C:\Windows\Temp\KioskClient-install.log
```

**Uninstall command:**
```batch
msiexec /x {8F5E3D2A-9B7C-4F1E-A3D6-2C9B8E7F4A1B} /qn
```
*(Replace GUID with actual ProductCode if changed)*

**Return codes:**
- `0` = Success
- `1603` = Fatal error (usually validation failure or missing prerequisites)
- `3010` = Success, reboot required

### 3. Detection Rule

**Method:** File detection

**Path:** `C:\Program Files\Kiosk Client\app\dist\index.js`

**File or folder:** File

**Detection method:** File or folder exists

**Alternative:** Registry detection
- **Key path:** `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{8F5E3D2A-9B7C-4F1E-A3D6-2C9B8E7F4A1B}`
- **Value name:** DisplayName
- **Detection method:** Key exists

### 4. Requirements

- **Operating system:** Windows 10 1607+ or Windows 11
- **Architecture:** x64
- **Minimum free disk space:** 500 MB

### 5. Deployment

- **Assignment:** Target device groups
- **Installation deadline:** Optional (recommended: 7 days)
- **Restart behavior:** Determine behavior based on return codes

## Upgrades

### Building a New Version

1. Update version in `build.bat`:
   ```batch
   build.bat 1.0.1
   ```

2. Install over existing version:
   ```batch
   msiexec /i KioskClient-v1.0.1.0.msi /qn SERVER_URL=http://... DEVICE_TOKEN=...
   ```

3. Installer will:
   - Stop the service
   - Uninstall old version (files removed except .env)
   - Install new version
   - Restore configuration from registry (if no new properties provided)
   - Restart service

### Configuration Preservation

- **Upgrade with new config:** Provide SERVER_URL and DEVICE_TOKEN → .env overwritten
- **Upgrade without config:** Omit properties → existing .env preserved
- **Backup:** Old .env copied to `.env.backup` before upgrade

## Customization

### 1. Branding Images

Replace placeholder images with professional branded designs:

- **banner.bmp** (493x58 pixels) - Top banner in installer
- **dialog.bmp** (493x312 pixels) - Welcome/completion dialog background

**Tools:**
- Adobe Photoshop
- GIMP (free)
- Paint.NET (free)

**Template:** Use `create-placeholder-images.ps1` as reference for dimensions

### 2. License Agreement

Edit `License.rtf` with your license terms. Use WordPad or Microsoft Word to edit RTF files.

### 3. Product Information

Edit `Product.wxs`:

```xml
<Product Id="*"
         Name="Your Product Name"
         Manufacturer="Your Company"
         UpgradeCode="8F5E3D2A-9B7C-4F1E-A3D6-2C9B8E7F4A1B">
```

**Important:** Keep the same `UpgradeCode` across versions to enable upgrades!

### 4. Service Configuration

Edit `Product.wxs` ServiceInstall element:

```xml
<ServiceInstall Id="KioskClientService"
                Name="YourServiceName"
                DisplayName="Your Service Display Name"
                Description="Your service description"
                Account="LocalSystem">  <!-- or custom account -->
```

## Troubleshooting

### Build Errors

**Error: candle.exe not found**
- **Solution:** Install WiX Toolset 3.11+ and add to PATH

**Error: TypeScript build failed**
- **Solution:** Run `npm install` in client directory, then `npm run build`

**Error: Failed to download Node.js**
- **Solution:** Check internet connection or manually download Node.js portable and extract to `installer/nodejs/`

**Error: npm install failed**
- **Solution:** Delete `node_modules` and run `npm install --production` again

### Installation Errors

**Error 1603: Silent install validation failed**
- **Cause:** Missing SERVER_URL or DEVICE_TOKEN
- **Solution:** Provide both required properties in command line

**Service fails to start**
- **Check logs:** `C:\Program Files\Kiosk Client\logs\`
- **Check config:** `C:\Program Files\Kiosk Client\app\.env`
- **Event Viewer:** Look for errors under Application log, source: KioskClient

**Chromium download stuck on first run**
- **Cause:** Firewall blocking Chromium download
- **Solution:** Configure firewall or pre-cache Chromium (see main README)

### Uninstall Issues

**Service not removed**
- **Manual removal:** `sc delete KioskClient`

**Files remain after uninstall**
- **Cause:** .env marked as permanent config file
- **Solution:** Manually delete `C:\Program Files\Kiosk Client\` if needed

## Advanced Configuration

### Custom Service Account

Instead of Local System, use a domain account or custom local account:

1. Edit `Product.wxs`:
   ```xml
   <ServiceInstall Account="[SERVICE_ACCOUNT]" Password="[SERVICE_PASSWORD]" />
   ```

2. Add properties to build command:
   ```batch
   msiexec /i KioskClient.msi /qn SERVICE_ACCOUNT="DOMAIN\user" SERVICE_PASSWORD="pass123"
   ```

### Pre-cache Chromium

Include Chromium in MSI to avoid first-run download:

1. Download Chromium: https://commondatastorage.googleapis.com/chromium-browser-snapshots/index.html
2. Extract to `client/.local-chromium/`
3. Modify `build.bat` to harvest .local-chromium folder
4. Add ComponentGroupRef to Product.wxs

**Trade-off:** Increases MSI size by ~150MB but eliminates first-run download

### Firewall Rules

Add Windows Firewall rules for WebSocket connection:

1. Create `firewall-rules.wxs`
2. Add firewall:FirewallException elements
3. Reference in Product.wxs
4. Requires WixFirewallExtension

## File Structure

```
installer/
├── Product.wxs              # Main WiX source file
├── ConfigDialog.wxs         # Custom configuration dialog
├── CustomActions.vbs        # VBScript custom actions
├── build.bat                # Build automation script
├── en-US.wxl                # Localization strings
├── License.rtf              # License agreement
├── banner.bmp               # Installer banner (493x58)
├── dialog.bmp               # Dialog background (493x312)
├── service.txt              # Service component marker
├── .env.temp                # Template .env file
├── create-placeholder-images.ps1  # Image generator script
├── README.md                # This file
├── ClientFiles.wxs          # Generated by Heat (client dist files)
├── NodeModules.wxs          # Generated by Heat (dependencies)
├── NodeJsRuntime.wxs        # Generated by Heat (Node.js runtime)
├── nodejs/                  # Downloaded Node.js portable (gitignored)
├── service/                 # Generated service config (gitignored)
└── KioskClient-v*.msi       # Generated installer (gitignored)
```

## Resources

- **WiX Toolset Documentation:** https://wixtoolset.org/documentation/manual/v3/
- **WiX Tutorial:** https://www.firegiant.com/wix/tutorial/
- **MSI Command-Line Options:** https://learn.microsoft.com/en-us/windows/win32/msi/command-line-options
- **Intune Win32 App Management:** https://learn.microsoft.com/en-us/mem/intune/apps/apps-win32-app-management
- **WiX Mailing List:** https://groups.google.com/g/wix-users

## Support

For issues with the installer:
1. Check build logs in `installer/` directory
2. Check installation logs: `C:\Windows\Temp\KioskClient-install.log`
3. Review Event Viewer (Application log)
4. Consult WiX documentation

For issues with the Kiosk client itself:
- See main README at `client/README.md`
- Check client logs at `C:\Program Files\Kiosk Client\logs\`

## License

MIT License - See `License.rtf` for full terms.

---

**Built with:** WiX Toolset 3, Node.js, TypeScript
**Version:** 1.0.0
**Last Updated:** 2024-12-16
