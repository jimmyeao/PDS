# Intune Win32 App Deployment Guide

## 📦 Complete Guide: PowerShell to Intune Win32 App

This guide walks through packaging the Kiosk Client installer as an Intune Win32 app for enterprise deployment.

---

## 🎯 Overview

**What we're doing:**
1. Build the client application
2. Prepare installation files
3. Package with Microsoft Win32 Content Prep Tool
4. Upload to Intune
5. Configure deployment settings
6. Assign to devices

---

## 📋 Prerequisites

### 1. Microsoft Win32 Content Prep Tool

Download from GitHub:
```powershell
# Create tools directory
New-Item -ItemType Directory -Path "C:\IntuneTools" -Force

# Download the tool
$url = "https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool/raw/master/IntuneWinAppUtil.exe"
Invoke-WebRequest -Uri $url -OutFile "C:\IntuneTools\IntuneWinAppUtil.exe"
```

**Or download manually:**
- https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool
- Extract `IntuneWinAppUtil.exe` to `C:\IntuneTools\`

### 2. Built Kiosk Client

```bash
cd client
npm run build
```

Verify `dist/` folder exists with compiled files.

---

## 🚀 Step-by-Step Packaging

### Step 1: Prepare Source Folder

Create a folder with ALL files needed for installation:

```powershell
# Create source directory
$SourceFolder = "C:\IntunePackaging\KioskClient\Source"
New-Item -ItemType Directory -Path $SourceFolder -Force

# Define paths
$ClientPath = "C:\Users\Jimmy.White\source\VSCODE Projects\kiosk\client"
$IntunePath = "$ClientPath\intune-package"

# Copy installation scripts
Copy-Item "$IntunePath\Install.ps1" -Destination $SourceFolder
Copy-Item "$IntunePath\Uninstall.ps1" -Destination $SourceFolder
Copy-Item "$IntunePath\Detection.ps1" -Destination $SourceFolder

# Copy built client files
Copy-Item "$ClientPath\dist" -Destination "$SourceFolder\dist" -Recurse -Force
Copy-Item "$ClientPath\package.json" -Destination $SourceFolder -Force

# Copy node_modules from monorepo root
$RootNodeModules = "C:\Users\Jimmy.White\source\VSCODE Projects\kiosk\node_modules"
Copy-Item $RootNodeModules -Destination "$SourceFolder\node_modules" -Recurse -Force

# Copy NSSM (if you have it bundled)
# Copy-Item "$IntunePath\nssm.exe" -Destination $SourceFolder -Force

Write-Host "✅ Source folder prepared: $SourceFolder" -ForegroundColor Green
```

**Optional: Bundle Node.js** (recommended to avoid download during install):

```powershell
# Download Node.js v20.18.1
$NodeUrl = "https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip"
$NodeZip = "$env:TEMP\nodejs.zip"

Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip -UseBasicParsing
Expand-Archive -Path $NodeZip -DestinationPath $env:TEMP -Force

# Copy to source folder
Copy-Item "$env:TEMP\node-v20.18.1-win-x64" -Destination "$SourceFolder\nodejs" -Recurse -Force

# Cleanup
Remove-Item $NodeZip -Force
Remove-Item "$env:TEMP\node-v20.18.1-win-x64" -Recurse -Force

Write-Host "✅ Node.js bundled in source folder" -ForegroundColor Green
```

**Your source folder should look like:**
```
C:\IntunePackaging\KioskClient\Source\
├── Install.ps1
├── Uninstall.ps1
├── Detection.ps1
├── dist\
│   └── (compiled client files)
├── node_modules\
│   └── (dependencies)
├── package.json
└── nodejs\ (optional)
    └── (Node.js runtime)
```

---

### Step 2: Create .intunewin Package

Run the Microsoft Win32 Content Prep Tool:

```powershell
# Set paths
$ToolPath = "C:\IntuneTools\IntuneWinAppUtil.exe"
$SourceFolder = "C:\IntunePackaging\KioskClient\Source"
$OutputFolder = "C:\IntunePackaging\KioskClient\Output"
$SetupFile = "Install.ps1"

# Create output folder
New-Item -ItemType Directory -Path $OutputFolder -Force

# Run the tool
& $ToolPath `
    -c $SourceFolder `
    -s $SetupFile `
    -o $OutputFolder `
    -q

Write-Host ""
Write-Host "✅ Package created: $OutputFolder\Install.intunewin" -ForegroundColor Green
```

**Command breakdown:**
- `-c` (content folder): Source folder with all files
- `-s` (setup file): Main installation file (Install.ps1)
- `-o` (output folder): Where to save .intunewin file
- `-q` (quiet): Suppress prompts

**Result:** `C:\IntunePackaging\KioskClient\Output\Install.intunewin`

---

### Step 3: Upload to Intune

#### A. Sign in to Microsoft Endpoint Manager

1. Go to https://endpoint.microsoft.com/
2. Sign in with admin credentials
3. Navigate to **Apps** → **Windows** → **Add**

#### B. Select App Type

- **App type:** Windows app (Win32)
- Click **Select**

#### C. Upload App Package

1. **App package file:**
   - Click **Select app package file**
   - Browse to: `C:\IntunePackaging\KioskClient\Output\Install.intunewin`
   - Click **OK**

#### D. App Information

Fill in the details:

| Field | Value |
|-------|-------|
| **Name** | Kiosk Digital Signage Client |
| **Description** | Digital signage client with remote management, live streaming, and playlist support |
| **Publisher** | Your Organization |
| **Category** | Productivity |
| **Show this as featured app** | No |
| **Information URL** | (optional) Your support URL |
| **Privacy URL** | (optional) Your privacy policy |
| **Developer** | Your IT Team |
| **Owner** | IT Department |
| **Notes** | Requires PowerShell and admin rights. Displays content from central server. |
| **Logo** | (optional) Upload a logo image |

Click **Next**

#### E. Program Configuration

**CRITICAL: Set the correct install commands!**

**For devices with FIXED server URL and token:**

**Install command:**
```powershell
powershell.exe -ExecutionPolicy Bypass -File Install.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceToken "REPLACE_WITH_ACTUAL_TOKEN"
```

**Or use DEVICE_ID for automatic token lookup:**
```powershell
powershell.exe -ExecutionPolicy Bypass -File Install.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceId "LoungeDisplay"
```

**Uninstall command:**
```powershell
powershell.exe -ExecutionPolicy Bypass -File Uninstall.ps1
```

| Setting | Value |
|---------|-------|
| **Install command** | See above |
| **Uninstall command** | `powershell.exe -ExecutionPolicy Bypass -File Uninstall.ps1` |
| **Install behavior** | System |
| **Device restart behavior** | No specific action |
| **Specify return codes** | (use defaults) |

Click **Next**

#### F. Requirements

| Setting | Value |
|---------|-------|
| **Operating system architecture** | 64-bit |
| **Minimum operating system** | Windows 10 1607 |
| **Disk space required (MB)** | 500 |
| **Physical memory required (MB)** | 2048 |
| **Minimum number of logical processors** | 1 |
| **Minimum CPU speed (MHz)** | 1000 |

**Additional requirement rules** (optional):
- Add custom PowerShell script to check prerequisites
- Example: Check network connectivity to server

Click **Next**

#### G. Detection Rules

**Method:** Use a custom detection script

1. **Detection script file:** Upload `Detection.ps1`
2. **Run script as 32-bit process:** No
3. **Enforce script signature check:** No

**Detection.ps1 checks:**
- Installation directory exists: `C:\Program Files\Kiosk Client`
- Application file exists: `C:\Program Files\Kiosk Client\app\dist\index.js`
- Service exists: `KioskClient`

Click **Next**

#### H. Dependencies

**Dependencies:** None (skip this section)

Click **Next**

#### I. Supersedence

**Supersedence:** None (skip unless you have an older version)

Click **Next**

#### J. Assignments

**Assign to device groups:**

1. **Required assignments:**
   - Click **Add group** under "Required"
   - Select device groups that MUST have the app
   - Example: "Kiosk Devices" group

2. **Available for enrolled devices:**
   - Optional: Make available for self-install
   - Example: "Test Kiosks" group

3. **Uninstall assignments:**
   - Optional: Force uninstall from specific groups

**Filters:**
- Apply filters if needed (OS version, device manufacturer, etc.)

Click **Next**

#### K. Review + Create

1. Review all settings
2. Click **Create**
3. Wait for upload to complete (may take several minutes for large packages)

---

## 🎯 Device-Specific Configuration

### Option 1: Fixed Server & Token (Simple)

Best for: Small deployments, same server for all devices

**Install command:**
```powershell
powershell.exe -ExecutionPolicy Bypass -File Install.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceToken "76DsItqcz0aW0IyZF3Ic0g"
```

### Option 2: Dynamic Device Assignment (Recommended)

Best for: Multiple devices with unique IDs

**Step 1:** Pre-create devices in admin dashboard with known Device IDs

**Step 2:** Use Device ID in install command:
```powershell
powershell.exe -ExecutionPolicy Bypass -File Install.ps1 -ServerUrl "http://192.168.0.57:5001" -DeviceId "%COMPUTERNAME%"
```

**Step 3:** Update Install.ps1 to fetch token by Device ID:
```powershell
# In Install.ps1, add API call to get token by Device ID
$response = Invoke-RestMethod -Uri "$ServerUrl/devices/by-id/$DeviceId/token" -Method Get
$DeviceToken = $response.token
```

### Option 3: Multiple App Versions (Different Servers)

Create separate Intune apps for different environments:

1. **Kiosk Client (Production)** → Server: `http://prod-server:5001`
2. **Kiosk Client (Test)** → Server: `http://test-server:5001`
3. **Kiosk Client (Dev)** → Server: `http://dev-server:5001`

Assign to different device groups.

---

## 📊 Monitoring Deployment

### Check Deployment Status

1. **In Intune:**
   - Apps → Kiosk Digital Signage Client → **Device install status**
   - View: Success, Failed, In Progress, Not Applicable

2. **On Target Device:**
   ```powershell
   # Check Intune logs
   Get-Content "C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\IntuneManagementExtension.log" -Tail 50

   # Check if service installed
   Get-Service -Name "KioskClient"

   # Check installation directory
   Get-ChildItem "C:\Program Files\Kiosk Client"
   ```

### Common Issues

#### "Install failed - Exit code: 1"
**Cause:** PowerShell script error

**Solution:**
1. Check device logs: `C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\`
2. Run Install.ps1 manually on test device to see detailed error
3. Verify parameters (ServerUrl, DeviceToken)

#### "Detection failed"
**Cause:** Detection script returns wrong exit code

**Solution:**
1. Run Detection.ps1 manually: `.\Detection.ps1; echo $LASTEXITCODE`
2. Should return 0 if installed, 1 if not installed
3. Check paths in Detection.ps1 match actual installation

#### "Not Applicable"
**Cause:** Device doesn't meet requirements

**Solution:**
1. Check OS version (must be Windows 10 1607+)
2. Check architecture (must be 64-bit)
3. Check device group assignment

---

## 🔄 Updating the Application

### Create a New Version

```powershell
# 1. Build new version
cd client
npm run build

# 2. Update version in package.json (optional)
# Edit package.json: "version": "1.1.0"

# 3. Prepare new source folder
$SourceFolder = "C:\IntunePackaging\KioskClient\Source_v1.1"
# ... copy files as before ...

# 4. Create new .intunewin package
& "C:\IntuneTools\IntuneWinAppUtil.exe" `
    -c $SourceFolder `
    -s "Install.ps1" `
    -o "C:\IntunePackaging\KioskClient\Output_v1.1" `
    -q

# 5. Upload to Intune as new version or separate app
```

### Update Existing App

1. **In Intune:** Apps → Kiosk Digital Signage Client → **Properties**
2. Click **Edit** next to "App package file"
3. **Select app package file** → Upload new .intunewin
4. Click **OK** → **Review + save**

**Intune will:**
- Stop the service
- Update files
- Restart the service

---

## 🎉 Testing Checklist

Before production deployment:

- [ ] Test installation on clean VM
- [ ] Verify service starts automatically
- [ ] Check browser window displays content
- [ ] Test remote control from admin dashboard
- [ ] Verify live streaming works
- [ ] Test uninstallation
- [ ] Check logs for errors
- [ ] Confirm device appears in admin dashboard
- [ ] Test automatic restart after reboot
- [ ] Verify configuration persists

---

## 📝 Quick Reference

### File Sizes

| Component | Approximate Size |
|-----------|-----------------|
| Install.ps1 | ~10 KB |
| Client (dist + node_modules) | ~100 MB |
| Node.js runtime (bundled) | ~50 MB |
| Total .intunewin package | ~150 MB |

### Installation Time

- **Download:** 2-5 minutes (depends on network)
- **Installation:** 3-10 minutes (depends on hardware)
- **Total:** ~5-15 minutes per device

### Disk Space

- Installation uses ~200 MB
- Recommend 500 MB requirement to be safe

---

## 🔒 Security Considerations

### Device Tokens

**⚠️ WARNING:** Device tokens are sensitive credentials!

**Best practices:**
1. Generate unique token per device
2. Store tokens securely (Azure Key Vault, Intune policies)
3. Rotate tokens regularly
4. Don't hardcode tokens in scripts shared publicly

### Secure Token Distribution

**Option A: Intune Configuration Profiles**
- Store tokens in device configuration policies
- Reference in install command via environment variable

**Option B: Azure Key Vault**
- Store tokens in Key Vault
- Install script fetches token using managed identity

**Option C: API Lookup**
- Pre-register devices with Device ID
- Install script calls API to get token: `/devices/by-id/{deviceId}/token`

---

## 📞 Support

**Deployment fails?**
1. Check Intune logs: `C:\ProgramData\Microsoft\IntuneManagementExtension\Logs\`
2. Run Install.ps1 manually to see detailed error
3. Verify network connectivity to server
4. Check device meets requirements

**Service won't start?**
1. Check service logs: `C:\Program Files\Kiosk Client\logs\`
2. Verify .env configuration
3. Test server connectivity: `Test-NetConnection 192.168.0.57 -Port 5001`
4. Check Chrome/Chromium installation

**Need help?**
- See `CLAUDE.md` for system documentation
- See `bug.md` for troubleshooting
- See `Install.ps1` for installation details
