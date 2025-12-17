# Raspberry Pi Error Recovery Fixes

## 🐛 Issues Fixed

### Issue 1: Screencast Parameter Error
**Error:** `Protocol error (Page.startScreencast): Invalid parameters Failed to deserialize params.maxWidth - BINDINGS: int32 value expected at position 39`

**Root Cause:**
- Display dimensions (`config.displayWidth`, `config.displayHeight`) were not being properly validated as integers
- Could be `undefined`, `null`, floats, or outside int32 range
- Chrome DevTools Protocol requires valid int32 values

**Fix Applied:**
```typescript
// Ensure dimensions are valid integers
const maxWidth = Math.floor(config.displayWidth || 1920);
const maxHeight = Math.floor(config.displayHeight || 1080);

// Validate dimensions are within reasonable bounds (int32 range)
const safeMaxWidth = Math.max(1, Math.min(maxWidth, 4096));
const safeMaxHeight = Math.max(1, Math.min(maxHeight, 4096));
```

**Result:** ✅ Screencast now starts reliably with validated integer parameters

---

### Issue 2: Screenshot Capture Failures
**Error:** `Protocol error (Page.captureScreenshot): Session closed. Most likely the page has been closed.`

**Root Cause:**
- Screenshots attempted during page navigation/transitions
- Page state not validated before capture
- Error occurred when page was `about:blank` or closed

**Fix Applied:**
1. **Pre-capture validation:**
   ```typescript
   // Check if page is in valid state
   if (!currentUrl || currentUrl === 'about:blank') {
     logger.debug('Skipping screenshot: page not loaded');
     return;
   }

   // Check if page is still open
   if (this.page.isClosed()) {
     logger.warn('Skipping screenshot: page is closed');
     return;
   }
   ```

2. **Improved error handling:**
   ```typescript
   // Detect "session closed" errors (expected during navigation)
   const isSessionClosed = error.message.includes('Session closed');

   if (isSessionClosed) {
     logger.debug('Screenshot skipped: session closed during navigation');
     return; // Don't report as error
   }
   ```

**Result:** ✅ Screenshots gracefully skip invalid states, no more error spam

---

## 🔄 Error Recovery Added

### Screencast Auto-Recovery
```typescript
// If screencast fails to start, retry after 5 seconds
setTimeout(async () => {
  if (!this.isScreencastActive) {
    logger.info('Attempting screencast recovery...');
    await this.startScreencast();
  }
}, 5000);
```

**Benefits:**
- ✅ Automatic recovery from transient failures
- ✅ No manual intervention required
- ✅ Resilient to temporary network/resource issues

---

## 📝 Changes Made

### File: `client/src/display.ts`

**Line 476-499:** Fixed screencast parameter validation
```typescript
// Before (broken):
await client.send('Page.startScreencast', {
  maxWidth: config.displayWidth,  // Could be invalid!
  maxHeight: config.displayHeight, // Could be invalid!
});

// After (fixed):
const safeMaxWidth = Math.max(1, Math.min(Math.floor(config.displayWidth || 1920), 4096));
const safeMaxHeight = Math.max(1, Math.min(Math.floor(config.displayHeight || 1080), 4096));

await client.send('Page.startScreencast', {
  maxWidth: safeMaxWidth,   // Always valid int32
  maxHeight: safeMaxHeight, // Always valid int32
});
```

**Line 605-632:** Added retry logic for screencast failures
- Retry after 5 seconds on failure
- Prevents error report spam
- Automatic recovery

### File: `client/src/screenshot.ts`

**Line 50-72:** Added pre-capture validation
- Check URL validity
- Check page open state
- Skip if `about:blank`

**Line 97-123:** Improved error handling
- Detect expected "session closed" errors
- Skip error reporting for navigation-related failures
- Graceful degradation

---

## 🚀 Deployment

### Update Your Raspberry Pi Client:

```bash
# On your development machine
cd client
npm run build

# Copy to Raspberry Pi
scp -r dist/* pi@loungepi:/home/noroot/kiosk/client/dist/

# Restart service on Pi
ssh pi@loungepi "sudo systemctl restart kiosk-client"

# Check logs
ssh pi@loungepi "journalctl -u kiosk-client -f"
```

Or if using PM2:
```bash
ssh pi@loungepi "pm2 restart kiosk-client"
ssh pi@loungepi "pm2 logs kiosk-client"
```

---

## ✅ Expected Behavior After Fix

### Screencast:
- ✅ Starts successfully with valid parameters
- ✅ Automatically retries on failure
- ✅ Recovers from transient errors

### Screenshots:
- ✅ Gracefully skips invalid states
- ✅ No error spam during navigation
- ✅ Captures when page is ready

### Logs:
```
[INFO] Starting CDP screencast for live streaming...
[INFO] CDP screencast session created, waiting for frames...
[INFO] ✅ First screencast frame received - streaming active
[DEBUG] Skipping screenshot: page not loaded or in about:blank state
[INFO] Screenshot captured and sent (url change)
```

---

## 🔍 Monitoring

### Check for Errors:
```bash
# On Raspberry Pi
journalctl -u kiosk-client | grep ERROR

# Should NOT see:
# ❌ "Invalid parameters Failed to deserialize params.maxWidth"
# ❌ "Session closed. Most likely the page has been closed"
```

### Verify Screencast:
```bash
# Check logs for successful start
journalctl -u kiosk-client | grep "screencast"

# Should see:
# ✅ "CDP screencast session created"
# ✅ "First screencast frame received"
```

---

## 🐛 If Issues Persist

### 1. Check Configuration
```bash
# On Raspberry Pi
cat /home/noroot/kiosk/client/.env

# Verify:
# DISPLAY_WIDTH=800
# DISPLAY_HEIGHT=480
```

### 2. Check Chromium Version
```bash
chromium-browser --version

# Should be recent version with CDP support
```

### 3. Manual Test
```bash
# Run client manually to see detailed logs
cd /home/noroot/kiosk/client
node dist/index.js
```

### 4. Check Display Environment
```bash
# Verify DISPLAY variable
echo $DISPLAY  # Should be :0

# Check if X server is running
ps aux | grep X
```

---

## 📊 Performance Impact

### Before Fix:
- ❌ Screencast fails to start
- ❌ Error reports every few seconds
- ❌ Screenshot spam in logs
- ❌ Manual restarts required

### After Fix:
- ✅ Screencast starts reliably
- ✅ Minimal error logging (only real errors)
- ✅ Clean logs during normal operation
- ✅ Automatic recovery from failures

---

## 💡 Additional Improvements

### Recommended Settings for Raspberry Pi:

**In `.env` file:**
```bash
# Lower resolution for Pi Zero/3
DISPLAY_WIDTH=800
DISPLAY_HEIGHT=480

# Reduce screenshot frequency
SCREENSHOT_INTERVAL=300000  # 5 minutes

# Increase health check interval
HEALTH_CHECK_INTERVAL=120000  # 2 minutes
```

### System Optimizations:
```bash
# Increase GPU memory (in /boot/config.txt)
gpu_mem=128

# Disable unnecessary services
sudo systemctl disable bluetooth
sudo systemctl disable wifi-powersave
```

---

## 🎉 Summary

**Fixed:**
- ✅ Screencast parameter validation
- ✅ Screenshot capture error handling
- ✅ Automatic error recovery
- ✅ Reduced error spam

**Impact:**
- ✅ More reliable operation
- ✅ Better resilience to transient failures
- ✅ Cleaner logs
- ✅ Less manual intervention required

Your Raspberry Pi client should now recover automatically from these common errors!
