using KioskClient.Core;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace KioskClient.Service;

public class KioskWorker : BackgroundService
{
    private readonly ILogger<KioskWorker> _logger;
    private readonly KioskConfiguration _config;
    private WebSocketClient? _wsClient;
    private BrowserController? _browser;
    private HealthMonitor? _healthMonitor;
    private Timer? _healthTimer;
    private Timer? _screenshotTimer;

    public KioskWorker(ILogger<KioskWorker> logger, KioskConfiguration config)
    {
        _logger = logger;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            _logger.LogInformation("Kiosk Client starting...");
            _logger.LogInformation("Device ID: {DeviceId}", _config.DeviceId);
            _logger.LogInformation("Server URL: {ServerUrl}", _config.ServerUrl);

            // Initialize components
            await InitializeAsync(stoppingToken);

            // Keep service running
            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(1000, stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Kiosk Client stopping...");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fatal error in Kiosk Client");
            throw;
        }
    }

    private async Task InitializeAsync(CancellationToken cancellationToken)
    {
        // Initialize browser
        _browser = new BrowserController(_config, new LoggerAdapter(_logger));
        await _browser.InitializeAsync();

        // Initialize health monitor
        _healthMonitor = new HealthMonitor(new LoggerAdapter(_logger));

        // Initialize WebSocket client
        _wsClient = new WebSocketClient(_config, new LoggerAdapter(_logger));
        _wsClient.OnMessage += HandleWebSocketMessage;

        await _wsClient.ConnectAsync(cancellationToken);

        // Start periodic health reports
        _healthTimer = new Timer(async _ => await SendHealthReportAsync(), null, TimeSpan.FromSeconds(10), TimeSpan.FromMilliseconds(_config.HealthReportIntervalMs));

        // Start periodic screenshots
        _screenshotTimer = new Timer(async _ => await SendScreenshotAsync(), null, TimeSpan.FromSeconds(30), TimeSpan.FromMilliseconds(_config.ScreenshotIntervalMs));

        _logger.LogInformation("Kiosk Client initialized successfully");
    }

    private async Task HandleWebSocketMessage(string eventName, JsonElement payload)
    {
        try
        {
            _logger.LogDebug("Handling event: {Event}", eventName);

            switch (eventName)
            {
                case "display:navigate":
                    if (payload.TryGetProperty("url", out var urlElement))
                    {
                        var url = urlElement.GetString();
                        if (!string.IsNullOrEmpty(url) && _browser != null)
                        {
                            await _browser.NavigateAsync(url);
                        }
                    }
                    break;

                case "display:refresh":
                    if (_browser != null)
                    {
                        await _browser.RefreshAsync();
                    }
                    break;

                case "screenshot:request":
                    await SendScreenshotAsync();
                    break;

                case "remote:click":
                    if (_browser != null &&
                        payload.TryGetProperty("x", out var xElement) &&
                        payload.TryGetProperty("y", out var yElement))
                    {
                        var button = payload.TryGetProperty("button", out var btnElement) ? btnElement.GetString() : "left";
                        await _browser.ClickAsync(xElement.GetInt32(), yElement.GetInt32(), button ?? "left");
                    }
                    break;

                case "remote:type":
                    if (_browser != null && payload.TryGetProperty("text", out var textElement))
                    {
                        var text = textElement.GetString();
                        var selector = payload.TryGetProperty("selector", out var selElement) ? selElement.GetString() : null;
                        if (!string.IsNullOrEmpty(text))
                        {
                            await _browser.TypeAsync(text, selector);
                        }
                    }
                    break;

                case "remote:key":
                    if (_browser != null && payload.TryGetProperty("key", out var keyElement))
                    {
                        var key = keyElement.GetString();
                        if (!string.IsNullOrEmpty(key))
                        {
                            await _browser.PressKeyAsync(key);
                        }
                    }
                    break;

                case "remote:scroll":
                    if (_browser != null &&
                        payload.TryGetProperty("x", out var scrollX) &&
                        payload.TryGetProperty("y", out var scrollY))
                    {
                        await _browser.ScrollAsync(scrollX.GetInt32(), scrollY.GetInt32());
                    }
                    break;

                case "content:update":
                    // TODO: Implement playlist execution
                    _logger.LogInformation("Received content update (playlist execution not yet implemented)");
                    break;

                case "config:update":
                    // TODO: Implement config updates
                    _logger.LogInformation("Received config update");
                    break;

                default:
                    _logger.LogWarning("Unhandled event: {Event}", eventName);
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling WebSocket message: {Event}", eventName);
        }
    }

    private async Task SendHealthReportAsync()
    {
        try
        {
            if (_healthMonitor != null && _wsClient != null)
            {
                var health = await _healthMonitor.GetHealthReportAsync();
                await _wsClient.SendEventAsync("health:report", new
                {
                    cpu = health.CpuPercent,
                    memory = health.MemoryPercent,
                    disk = health.DiskPercent,
                    timestamp = health.Timestamp
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send health report");
        }
    }

    private async Task SendScreenshotAsync()
    {
        try
        {
            if (_browser != null && _wsClient != null)
            {
                var screenshot = await _browser.CaptureScreenshotAsync();
                var currentUrl = _browser.GetCurrentUrl();

                await _wsClient.SendEventAsync("screenshot:upload", new
                {
                    deviceStringId = _config.DeviceId,
                    imageBase64 = screenshot,
                    currentUrl
                });

                _logger.LogDebug("Screenshot sent");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send screenshot");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Kiosk Client stopping...");

        _healthTimer?.Dispose();
        _screenshotTimer?.Dispose();

        if (_wsClient != null)
        {
            await _wsClient.DisconnectAsync();
            _wsClient.Dispose();
        }

        if (_browser != null)
        {
            await _browser.DisposeAsync();
        }

        _healthMonitor?.Dispose();

        await base.StopAsync(cancellationToken);
    }
}

// Adapter to bridge ILogger to our simple ILogger interface
public class LoggerAdapter : Core.ILogger
{
    private readonly Microsoft.Extensions.Logging.ILogger _logger;

    public LoggerAdapter(Microsoft.Extensions.Logging.ILogger logger)
    {
        _logger = logger;
    }

    public void LogInformation(string message, params object[] args) => _logger.LogInformation(message, args);
    public void LogWarning(Exception? exception, string message, params object[] args) => _logger.LogWarning(exception, message, args);
    public void LogWarning(string message, params object[] args) => _logger.LogWarning(message, args);
    public void LogError(Exception? exception, string message, params object[] args) => _logger.LogError(exception, message, args);
    public void LogDebug(string message, params object[] args) => _logger.LogDebug(message, args);
}
