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
    private PlaylistExecutor? _playlistExecutor;
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

        // Set up screencast frame handler
        _browser.SetScreencastFrameHandler((frameData, metadata) =>
        {
            if (_wsClient != null)
            {
                _wsClient.SendEventAsync("screencast:frame", new
                {
                    data = frameData,
                    metadata = metadata
                }).Wait();
            }
        });

        // Initialize health monitor
        _healthMonitor = new HealthMonitor(new LoggerAdapter(_logger));

        // Initialize playlist executor
        _playlistExecutor = new PlaylistExecutor(new LoggerAdapter(_logger), _browser, _config.ServerUrl);

        // Set up screenshot handler for when playlist items change
        _playlistExecutor.OnScreenshotReady += async (screenshot, currentUrl) =>
        {
            try
            {
                if (_wsClient != null)
                {
                    await _wsClient.SendEventAsync("screenshot:upload", new
                    {
                        image = screenshot,  // Match Node.js client property name
                        currentUrl
                    });
                    _logger.LogInformation("Screenshot sent after playlist item change ({Length} bytes)", screenshot.Length);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send screenshot after item change");
            }
        };

        // Initialize WebSocket client
        _wsClient = new WebSocketClient(_config, new LoggerAdapter(_logger));

        // Set up playback state handler to send updates via WebSocket
        _playlistExecutor.SetStateUpdateHandler(state =>
        {
            if (_wsClient != null)
            {
                try
                {
                    // Use Task.Run to fire-and-forget the async operation
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await _wsClient.SendEventAsync("playback:state:update", state);
                            var stateJson = System.Text.Json.JsonSerializer.Serialize(state);
                            _logger.LogInformation("Playback state sent: {State}", stateJson);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to send playback state update");
                        }
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to queue playback state update");
                }
            }
        });
        _wsClient.OnMessage += HandleWebSocketMessage;

        await _wsClient.ConnectAsync(cancellationToken);

        // Start periodic health reports
        _healthTimer = new Timer(_ =>
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    await SendHealthReportAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in health report timer");
                }
            });
        }, null, TimeSpan.FromSeconds(10), TimeSpan.FromMilliseconds(_config.HealthReportIntervalMs));

        // Screenshots are now sent 3 seconds after playlist item changes (handled by PlaylistExecutor)
        // No periodic screenshot timer needed

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
                    if (_playlistExecutor != null && payload.TryGetProperty("items", out var itemsElement))
                    {
                        var playlistId = payload.TryGetProperty("playlistId", out var playlistIdElement) ? playlistIdElement.GetInt32() : 0;

                        var items = new List<Core.PlaylistItem>();
                        foreach (var item in itemsElement.EnumerateArray())
                        {
                            items.Add(new Core.PlaylistItem
                            {
                                Id = item.GetProperty("id").GetInt32(),
                                PlaylistId = item.TryGetProperty("playlistId", out var pid) ? pid.GetInt32() : 0,
                                ContentId = item.TryGetProperty("contentId", out var cid) ? cid.GetInt32() : null,
                                Url = item.TryGetProperty("content", out var content) && content.TryGetProperty("url", out var url) ? url.GetString() : null,
                                DurationSeconds = item.TryGetProperty("displayDuration", out var dur) ? dur.GetInt32() / 1000 : 0,
                                OrderIndex = item.TryGetProperty("orderIndex", out var order) ? order.GetInt32() : 0,
                                TimeWindowStart = item.TryGetProperty("timeWindowStart", out var tws) ? tws.GetString() : null,
                                TimeWindowEnd = item.TryGetProperty("timeWindowEnd", out var twe) ? twe.GetString() : null,
                                DaysOfWeek = item.TryGetProperty("daysOfWeek", out var dow) ? dow.GetRawText() : null
                            });
                        }

                        _playlistExecutor.LoadPlaylist(playlistId, items);
                        _playlistExecutor.Start();
                        _logger.LogInformation("Playlist loaded and started with {Count} items", items.Count);
                    }
                    break;

                case "config:update":
                    // TODO: Implement config updates
                    _logger.LogInformation("Received config update");
                    break;

                case "screencast:start":
                    if (_browser != null)
                    {
                        _logger.LogInformation("Starting screencast...");
                        await _browser.StartScreencastAsync();
                    }
                    break;

                case "screencast:stop":
                    if (_browser != null)
                    {
                        _logger.LogInformation("Stopping screencast...");
                        await _browser.StopScreencastAsync();
                    }
                    break;

                case "playlist:pause":
                    if (_playlistExecutor != null)
                    {
                        _logger.LogInformation("Pausing playlist...");
                        _playlistExecutor.Pause();
                    }
                    break;

                case "playlist:resume":
                    if (_playlistExecutor != null)
                    {
                        _logger.LogInformation("Resuming playlist...");
                        _playlistExecutor.Resume();
                    }
                    break;

                case "playlist:next":
                    if (_playlistExecutor != null)
                    {
                        _logger.LogInformation("Advancing to next playlist item...");
                        _playlistExecutor.Next();
                    }
                    break;

                case "playlist:previous":
                    if (_playlistExecutor != null)
                    {
                        _logger.LogInformation("Going back to previous playlist item...");
                        _playlistExecutor.Previous();
                    }
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
                    image = screenshot,  // Match Node.js client property name
                    currentUrl
                });

                _logger.LogInformation("Screenshot sent successfully ({Length} bytes)", screenshot.Length);
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

        _playlistExecutor?.Dispose();

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
