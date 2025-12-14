# Remote Browser Control - Usage Guide

The system now supports remote browser interaction, allowing admins to control the browser on Raspberry Pi clients.

## 🎯 Features Implemented

### Remote Control Commands
- **Remote Click** - Click at specific coordinates
- **Remote Type** - Type text into form fields
- **Remote Key** - Press keyboard keys (Enter, Tab, etc.)
- **Remote Scroll** - Scroll the page

## 📡 WebSocket Events

### Server → Client Events
- `remote:click` - Click at (x, y) coordinates
- `remote:type` - Type text (optionally into a CSS selector)
- `remote:key` - Press a key with optional modifiers
- `remote:scroll` - Scroll absolute or relative

## 🧪 Testing Remote Control

### Using Backend Code (Quick Test)

Add this helper to your .NET backend `Program.cs` for manual testing:

```csharp
// Add this endpoint for testing remote control
app.MapPost("/devices/{deviceId}/remote/click", async (string deviceId, [FromBody] ClickRequest req) =>
{
    await RealtimeHub.SendToDevice(deviceId, "remote:click", new { x = req.X, y = req.Y, button = req.Button ?? "left" });
    return Results.Ok(new { message = "Click sent" });
}).RequireAuthorization();

app.MapPost("/devices/{deviceId}/remote/type", async (string deviceId, [FromBody] TypeRequest req) =>
{
    await RealtimeHub.SendToDevice(deviceId, "remote:type", new { text = req.Text, selector = req.Selector });
    return Results.Ok(new { message = "Type sent" });
}).RequireAuthorization();

app.MapPost("/devices/{deviceId}/remote/key", async (string deviceId, [FromBody] KeyRequest req) =>
{
    await RealtimeHub.SendToDevice(deviceId, "remote:key", new { key = req.Key, modifiers = req.Modifiers });
    return Results.Ok(new { message = "Key sent" });
}).RequireAuthorization();

// DTOs
public record ClickRequest(int X, int Y, string? Button);
public record TypeRequest(string Text, string? Selector);
public record KeyRequest(string Key, string[]? Modifiers);
```

### Example API Calls

```bash
# Click at coordinates (500, 300)
curl -X POST http://localhost:5001/devices/pi-1/remote/click \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"x": 500, "y": 300, "button": "left"}'

# Type text into a form field
curl -X POST http://localhost:5001/devices/pi-1/remote/type \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "admin@example.com", "selector": "#email"}'

# Type password
curl -X POST http://localhost:5001/devices/pi-1/remote/type \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "mypassword", "selector": "#password"}'

# Press Enter key
curl -X POST http://localhost:5001/devices/pi-1/remote/key \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "Enter"}'

# Press Ctrl+A
curl -X POST http://localhost:5001/devices/pi-1/remote/key \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "KeyA", "modifiers": ["Control"]}'
```

## 🎨 Frontend Integration (Future Enhancement)

Create a Remote Control UI in the admin panel:

### Option 1: Simple Control Panel

```typescript
// components/RemoteControl.tsx
export const RemoteControl = ({ deviceId }: { deviceId: string }) => {
  const handleClick = async (x: number, y: number) => {
    await api.post(`/devices/${deviceId}/remote/click`, { x, y });
  };

  const handleType = async (text: string, selector?: string) => {
    await api.post(`/devices/${deviceId}/remote/type`, { text, selector });
  };

  return (
    <div className="remote-control">
      <input
        type="text"
        placeholder="Type text..."
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleType(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
      />
      <button onClick={() => handleKey('Enter')}>Enter</button>
      <button onClick={() => handleKey('Tab')}>Tab</button>
      <button onClick={() => handleKey('Escape')}>ESC</button>
    </div>
  );
};
```

### Option 2: Visual Screenshot Viewer with Click-to-Control

```typescript
// components/ScreenshotViewer.tsx
export const ScreenshotViewer = ({ deviceId, screenshotUrl }: Props) => {
  const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    // Send click command to device
    await api.post(`/devices/${deviceId}/remote/click`, { x, y });

    // Request new screenshot after click
    setTimeout(() => requestScreenshot(deviceId), 1000);
  };

  return (
    <div>
      <img
        src={screenshotUrl}
        onClick={handleImageClick}
        className="cursor-crosshair"
        alt="Device screen"
      />
      <div className="controls">
        <input
          placeholder="Type text..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              sendType(deviceId, e.currentTarget.value);
            }
          }}
        />
      </div>
    </div>
  );
};
```

## 🔐 Use Cases

### 1. Handle Website Authentication
```bash
# Navigate to login page
curl -X POST /devices/pi-1/remote/type \
  -d '{"text": "user@example.com", "selector": "input[name=email]"}'

curl -X POST /devices/pi-1/remote/type \
  -d '{"text": "password123", "selector": "input[name=password]"}'

curl -X POST /devices/pi-1/remote/key \
  -d '{"key": "Enter"}'
```

### 2. Fill Interactive Forms
```bash
# Fill out a multi-field form
curl -X POST /devices/pi-1/remote/type \
  -d '{"text": "John Doe", "selector": "#fullName"}'

curl -X POST /devices/pi-1/remote/key \
  -d '{"key": "Tab"}'

curl -X POST /devices/pi-1/remote/type \
  -d '{"text": "john@example.com"}'
```

### 3. Navigate Interactive Dashboards
```bash
# Click on a specific dashboard element
curl -X POST /devices/pi-1/remote/click \
  -d '{"x": 800, "y": 400}'

# Scroll to see more content
curl -X POST /devices/pi-1/remote/scroll \
  -d '{"deltaY": 500}'
```

## 🚀 Next Steps

1. **Add Backend Endpoints** - Add the POST endpoints shown above to your .NET backend
2. **Test with curl** - Use the curl examples to test remote control
3. **Build Admin UI** - Create a remote control panel in your frontend
4. **Add Screenshot Viewer** - Combine with screenshot API for visual control
5. **Store Credentials** - Save login credentials in content/playlist config for auto-login

## 📝 Notes

- The client logs all remote control actions for debugging
- Coordinates are absolute pixel positions from top-left (0,0)
- CSS selectors work with any valid selector (`#id`, `.class`, `input[name=foo]`)
- Keyboard keys use Puppeteer's key names (`Enter`, `Tab`, `ArrowDown`, etc.)
- All commands are executed via Puppeteer on the actual Chromium browser

## 🔍 Debugging

Check client logs to see remote control execution:
```bash
# On Raspberry Pi
journalctl -u kiosk-client -f

# Or check log files
tail -f /var/log/kiosk-client.log
```

You should see:
```
[INFO] Remote click at (500, 300) with left button
[INFO] Remote click executed successfully
[INFO] Remote type: "admin@example.com" in selector: #email
[INFO] Remote type executed successfully
```
