# Kiosk Digital Signage Client - Windows Setup

Windows client for Intel NUCs and other Windows-based digital signage displays.

## Prerequisites

### 1. Install Node.js

Download and install Node.js LTS (v20 or higher) from [nodejs.org](https://nodejs.org/)

Verify installation:
```powershell
node --version
npm --version
```

### 2. Install Chrome or Edge

The client uses Puppeteer to control a browser. You can use:
- **Google Chrome** (recommended) - [Download](https://www.google.com/chrome/)
- **Microsoft Edge** (built into Windows)

## Quick Start

### 1. Extract the Client

Extract the deployment package to a location on your Windows machine:
```
C:\KioskClient\
```

### 2. Configure the Client

Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```

Edit `.env` with your settings:
```env
SERVER_URL=http://your-server-ip:3000
DEVICE_TOKEN=your-device-token-here
DISPLAY_WIDTH=1920
DISPLAY_HEIGHT=1080
KIOSK_MODE=true

# Optional: Specify Chrome/Edge path if auto-detection fails
# PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

### 3. Get Your Device Token

1. Open the admin UI in your browser
2. Go to the **Devices** page
3. Click **"+ Add Device"**
4. Fill in the device details (Device ID, Name, Location)
5. Click **"Add Device"**
6. **Copy the token** that appears (it's only shown once!)
7. Paste the token into your `.env` file as `DEVICE_TOKEN`

### 4. Run the Client

**Option A: Run directly (for testing)**
```powershell
.\start.bat
```

Or with PowerShell:
```powershell
.\start.ps1
```

**Option B: Install as Windows Service (recommended for production)**

See the "Running as a Service" section below.

## Running as a Windows Service

### Using NSSM (Recommended)

NSSM (Non-Sucking Service Manager) makes it easy to run Node.js apps as Windows services.

#### 1. Download NSSM

Download from [nssm.cc](https://nssm.cc/download) and extract to a folder (e.g., `C:\nssm`).

Add NSSM to your PATH or install it system-wide:
```powershell
# Copy nssm.exe to Windows directory (requires admin)
Copy-Item "C:\nssm\win64\nssm.exe" "C:\Windows\System32\"
```

#### 2. Install the Service

Run the provided installation script with administrator privileges:
```powershell
# Right-click PowerShell and "Run as Administrator"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\install-service.ps1
```

Or manually install:
```powershell
nssm install KioskClient node "C:\KioskClient\dist\index.js"
nssm set KioskClient AppDirectory "C:\KioskClient"
nssm set KioskClient DisplayName "Kiosk Digital Signage Client"
nssm set KioskClient Start SERVICE_AUTO_START
```

#### 3. Manage the Service

Start the service:
```powershell
nssm start KioskClient
```

Stop the service:
```powershell
nssm stop KioskClient
```

Check status:
```powershell
nssm status KioskClient
```

View/edit service configuration:
```powershell
nssm edit KioskClient
```

Remove the service:
```powershell
nssm remove KioskClient confirm
```

### Using Task Scheduler (Alternative)

You can also use Windows Task Scheduler to auto-start the client:

1. Open **Task Scheduler**
2. Click **"Create Task"** (not "Create Basic Task")
3. **General tab:**
   - Name: `Kiosk Client`
   - Check **"Run whether user is logged on or not"**
   - Check **"Run with highest privileges"**
4. **Triggers tab:**
   - New trigger: **"At startup"**
5. **Actions tab:**
   - Action: **"Start a program"**
   - Program: `C:\Program Files\nodejs\node.exe`
   - Arguments: `dist\index.js`
   - Start in: `C:\KioskClient`
6. **Conditions tab:**
   - Uncheck **"Start the task only if the computer is on AC power"**
7. Click **OK** and enter your Windows password

## Display Configuration

### Full Screen Kiosk Mode

The client runs in kiosk mode by default (`KIOSK_MODE=true`), which:
- Launches browser in full screen
- Hides the address bar and browser UI
- Prevents accidental closure

### Multiple Monitors

To display on a specific monitor, adjust the window position in `config.ts` or use Windows display settings to set the target monitor as primary before starting the client.

### Resolution

Set `DISPLAY_WIDTH` and `DISPLAY_HEIGHT` in `.env` to match your display's native resolution:

```env
# 1080p Full HD
DISPLAY_WIDTH=1920
DISPLAY_HEIGHT=1080

# 4K Ultra HD
DISPLAY_WIDTH=3840
DISPLAY_HEIGHT=2160

# Portrait mode (rotate display in Windows settings)
DISPLAY_WIDTH=1080
DISPLAY_HEIGHT=1920
```

## Troubleshooting

### Browser Not Found

If you see "Could not find Chrome/Chromium", set the executable path in `.env`:

```env
# For Chrome
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# For Edge
PUPPETEER_EXECUTABLE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
```

### Cannot Connect to Server

Check:
1. `SERVER_URL` in `.env` is correct
2. The backend server is running and accessible
3. Firewall allows outbound connections on port 3000
4. Network connectivity: `ping your-server-ip`

### Client Crashes on Startup

Check the logs:
- If running directly: Check the console output
- If running as service: Check `logs\stdout.log` and `logs\stderr.log`

Common issues:
- Invalid or missing `DEVICE_TOKEN`
- Network connectivity problems
- Port conflicts
- Missing dependencies (run `npm install`)

### Windows Defender SmartScreen Warning

When running the client for the first time, Windows may show a SmartScreen warning. This is normal for unsigned applications. Click **"More info"** and then **"Run anyway"**.

### Auto-Login Windows (Optional)

For dedicated kiosk machines, you may want Windows to auto-login:

1. Press `Win + R`, type `netplwiz`, press Enter
2. Uncheck **"Users must enter a user name and password to use this computer"**
3. Click **OK** and enter your password
4. Restart to test

## Updates

To update the client:

1. Stop the service (if running): `nssm stop KioskClient`
2. Backup your `.env` file
3. Extract the new client version over the old files
4. Restore your `.env` file
5. Start the service: `nssm start KioskClient`

## Advanced Configuration

### Logging Level

Adjust logging verbosity in `.env`:
```env
LOG_LEVEL=info    # Options: debug, info, warn, error
```

### Health Check Interval

How often to send health reports to the server (in milliseconds):
```env
HEALTH_CHECK_INTERVAL=60000  # 1 minute
```

### Screenshot Interval

How often to capture and upload screenshots (in milliseconds):
```env
SCREENSHOT_INTERVAL=300000  # 5 minutes
```

## Security Considerations

- Store the `.env` file securely (it contains the device token)
- Use a dedicated Windows account with minimal privileges for the service
- Enable Windows Firewall and only allow necessary outbound connections
- Keep Windows, Node.js, and Chrome/Edge up to date
- Consider using Windows Kiosk Mode for public-facing displays

## Support

For issues, check:
- Backend server logs
- Client logs (`logs\` folder if running as service)
- Admin UI for device status and errors
- Network connectivity and firewall settings
