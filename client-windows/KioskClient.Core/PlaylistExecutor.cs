using System.Text.Json;

namespace KioskClient.Core;

public class PlaylistExecutor
{
    private readonly ILogger _logger;
    private readonly BrowserController _browser;
    private readonly string _serverUrl;
    private List<PlaylistItem> _playlistItems = new();
    private int _currentIndex = 0;
    private Timer? _rotationTimer;
    private bool _isRunning = false;
    private int _currentPlaylistId = 0;
    private bool _isPaused = false;
    private DateTime _pausedAt;
    private int _remainingDurationMs = 0;
    private DateTime _currentItemStartTime;
    private Timer? _stateEmissionTimer;
    private Action<object>? _onStateUpdate;

    public event Action<string, string>? OnScreenshotReady;

    public PlaylistExecutor(ILogger logger, BrowserController browser, string serverUrl)
    {
        _logger = logger;
        _browser = browser;
        _serverUrl = serverUrl;
    }

    public void SetStateUpdateHandler(Action<object> handler)
    {
        _onStateUpdate = handler;
    }

    public void LoadPlaylist(int playlistId, List<PlaylistItem> items)
    {
        _logger.LogInformation("Loading playlist {PlaylistId} with {Count} items", playlistId, items.Count);

        // Store old playlist for comparison
        var oldPlaylist = _playlistItems.ToList();
        var wasRunning = _isRunning;

        _currentPlaylistId = playlistId;
        _playlistItems = items.OrderBy(i => i.OrderIndex).ToList();

        // Restart execution if already running
        if (wasRunning)
        {
            // Check if we need to restart:
            // - If it's a single permanent item (duration 0) and it hasn't changed, don't restart
            // - If current item still exists in new playlist, don't restart
            var currentItem = _playlistItems.Count > 0 && _currentIndex > 0
                ? oldPlaylist.ElementAtOrDefault((_currentIndex - 1 + oldPlaylist.Count) % oldPlaylist.Count)
                : null;

            var currentStillExists = currentItem != null && _playlistItems.Any(i => i.Id == currentItem.Id);
            var isPermanentDisplay = _playlistItems.Count == 1 && _playlistItems[0].DurationSeconds == 0;
            var wasPermanentDisplay = oldPlaylist.Count == 1 && oldPlaylist[0]?.DurationSeconds == 0;
            var sameContent = isPermanentDisplay && wasPermanentDisplay &&
                              _playlistItems[0].Id == oldPlaylist[0].Id;

            if (sameContent)
            {
                _logger.LogInformation("Permanent display item unchanged - no restart needed");
                return;
            }

            if (currentStillExists && !isPermanentDisplay)
            {
                _logger.LogInformation("Current item still in playlist - updating playlist without restart");
                return;
            }

            _logger.LogInformation("Playlist changed significantly - restarting executor");
            Stop();
            Start();
        }
    }

    public void Start()
    {
        if (_isRunning)
        {
            _logger.LogWarning("Playlist executor already running");
            return;
        }

        if (_playlistItems.Count == 0)
        {
            _logger.LogWarning("Cannot start playlist executor: no playlist items loaded");
            return;
        }

        _logger.LogInformation("Starting playlist executor");
        _isRunning = true;
        _isPaused = false;
        _currentIndex = 0;

        // Start periodic state emission (every 5 seconds)
        _stateEmissionTimer = new Timer(_ => EmitStateUpdate(), null, TimeSpan.Zero, TimeSpan.FromSeconds(5));

        EmitStateUpdate();
        ExecuteNextItem();
    }

    public void Stop()
    {
        _rotationTimer?.Dispose();
        _rotationTimer = null;
        _stateEmissionTimer?.Dispose();
        _stateEmissionTimer = null;
        _isRunning = false;
        _isPaused = false;
        _logger.LogInformation("Playlist executor stopped");
        EmitStateUpdate();
    }

    private void ExecuteNextItem()
    {
        if (!_isRunning || _playlistItems.Count == 0)
            return;

        // Find next valid item
        var item = GetNextValidItem();

        if (item == null)
        {
            _logger.LogWarning("No valid playlist items to display at this time");
            // Retry after 1 minute
            _rotationTimer = new Timer(_ => ExecuteNextItem(), null, TimeSpan.FromMinutes(1), Timeout.InfiniteTimeSpan);
            return;
        }

        _logger.LogInformation("Executing playlist item {ItemId} (URL: {Url})", item.Id, item.Url);

        // Navigate to content
        DisplayContent(item);

        // Record start time for pause/resume
        _currentItemStartTime = DateTime.Now;

        // Emit state update after displaying content
        EmitStateUpdate();

        // Schedule screenshot 3 seconds after content loads
        _ = Task.Run(async () =>
        {
            await Task.Delay(3000);
            if (_browser != null)
            {
                try
                {
                    var screenshot = await _browser.CaptureScreenshotAsync();
                    var currentUrl = _browser.GetCurrentUrl();
                    // Signal screenshot ready (will be handled by worker)
                    OnScreenshotReady?.Invoke(screenshot, currentUrl);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to capture screenshot after item change");
                }
            }
        });

        // Determine next rotation timing
        var nextDelay = item.DurationSeconds * 1000;

        _logger.LogInformation("Next rotation in {Delay}ms (duration: {Duration}s, playlist count: {Count})",
            nextDelay, item.DurationSeconds, _playlistItems.Count);

        // If duration is 0 and only one item, display permanently
        if (nextDelay == 0 && _playlistItems.Count == 1)
        {
            _logger.LogInformation("Displaying permanently without rotation (single item)");
            return;
        }

        // If duration is 0 but multiple items, use default 15 seconds
        if (nextDelay == 0 && _playlistItems.Count > 1)
        {
            nextDelay = 15000;
            _logger.LogWarning("Item duration is 0 but playlist has {Count} items; using default 15s rotation", _playlistItems.Count);
        }

        // Schedule next rotation
        _rotationTimer = new Timer(_ =>
        {
            try
            {
                ExecuteNextItem();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in playlist rotation timer");
            }
        }, null, TimeSpan.FromMilliseconds(nextDelay), Timeout.InfiniteTimeSpan);
    }

    private PlaylistItem? GetNextValidItem()
    {
        var now = DateTime.Now;
        var currentDay = (int)now.DayOfWeek;
        var currentTime = now.ToString("HH:mm");

        int attempts = 0;
        int maxAttempts = _playlistItems.Count;

        while (attempts < maxAttempts)
        {
            var item = _playlistItems[_currentIndex];

            // Check day of week constraint
            if (!string.IsNullOrEmpty(item.DaysOfWeek))
            {
                try
                {
                    var daysOfWeek = JsonSerializer.Deserialize<int[]>(item.DaysOfWeek);
                    if (daysOfWeek != null && !daysOfWeek.Contains(currentDay))
                    {
                        _logger.LogDebug("Item {ItemId} skipped: wrong day of week", item.Id);
                        _currentIndex = (_currentIndex + 1) % _playlistItems.Count;
                        attempts++;
                        continue;
                    }
                }
                catch
                {
                    // Invalid JSON, skip constraint
                }
            }

            // Check time window constraint
            if (!string.IsNullOrEmpty(item.TimeWindowStart) && !string.IsNullOrEmpty(item.TimeWindowEnd))
            {
                if (string.Compare(currentTime, item.TimeWindowStart) < 0 || string.Compare(currentTime, item.TimeWindowEnd) > 0)
                {
                    _logger.LogDebug("Item {ItemId} skipped: outside time window", item.Id);
                    _currentIndex = (_currentIndex + 1) % _playlistItems.Count;
                    attempts++;
                    continue;
                }
            }

            // Item is valid
            _currentIndex = (_currentIndex + 1) % _playlistItems.Count;
            return item;
        }

        return null;
    }

    private async void DisplayContent(PlaylistItem item)
    {
        try
        {
            if (string.IsNullOrEmpty(item.Url))
            {
                _logger.LogError(null, "Playlist item {ItemId} missing URL", item.Id);
                // Skip to next item after a short delay
                _rotationTimer?.Dispose();
                _rotationTimer = new Timer(_ => ExecuteNextItem(), null, TimeSpan.FromSeconds(3), Timeout.InfiniteTimeSpan);
                return;
            }

            // Convert relative URLs to absolute URLs
            var url = item.Url;
            if (url.StartsWith("/"))
            {
                url = $"{_serverUrl.TrimEnd('/')}{url}";
                _logger.LogDebug("Converted relative URL {RelativeUrl} to absolute URL {AbsoluteUrl}", item.Url, url);
            }

            await _browser.NavigateAsync(url);

            if (item.DurationSeconds == 0)
            {
                _logger.LogInformation("✅ Displaying content {Url} permanently (duration: 0)", item.Url ?? "");
            }
            else
            {
                _logger.LogInformation("✅ Displaying content {Url} for {Duration}s", item.Url ?? "", item.DurationSeconds);
            }
        }
        catch (Exception ex) when (ex.Message.Contains("Target page, context or browser has been closed") ||
                                    ex.Message.Contains("TargetClosedException"))
        {
            _logger.LogError(ex, "Browser/page was closed while displaying content {Url}. Waiting for recovery (10 seconds)...", item.Url ?? "");
            // Give browser recovery time to complete before trying next item (increased delay)
            _rotationTimer?.Dispose();
            _rotationTimer = new Timer(_ => ExecuteNextItem(), null, TimeSpan.FromSeconds(10), Timeout.InfiniteTimeSpan);
        }
        catch (Exception ex) when (ex.Message.Contains("Page crashed") ||
                                    ex.Message.Contains("Target crashed") ||
                                    ex.Message.Contains("STATUS_ACCESS_VIOLATION"))
        {
            _logger.LogError(ex, "Browser crashed while displaying content {Url}. Recovery will be attempted automatically. Continuing playlist in 7 seconds...", item.Url ?? "");
            // Give browser recovery time to complete before trying next item
            _rotationTimer?.Dispose();
            _rotationTimer = new Timer(_ => ExecuteNextItem(), null, TimeSpan.FromSeconds(7), Timeout.InfiniteTimeSpan);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to display content {Url}. Continuing to next item in 3 seconds...", item.Url ?? "");
            // Skip to next item after a short delay
            _rotationTimer?.Dispose();
            _rotationTimer = new Timer(_ => ExecuteNextItem(), null, TimeSpan.FromSeconds(3), Timeout.InfiniteTimeSpan);
        }
    }

    public void Pause()
    {
        if (!_isRunning || _isPaused)
        {
            _logger.LogWarning("Cannot pause: executor not running or already paused (isRunning={IsRunning}, isPaused={IsPaused})", _isRunning, _isPaused);
            return;
        }

        _logger.LogInformation("Pausing playlist");
        _isPaused = true;
        _pausedAt = DateTime.Now;

        // Calculate remaining duration for current item
        if (_rotationTimer != null)
        {
            var elapsed = (int)(DateTime.Now - _currentItemStartTime).TotalMilliseconds;
            var currentItem = _playlistItems[(_currentIndex - 1 + _playlistItems.Count) % _playlistItems.Count];
            var totalDuration = currentItem.DurationSeconds * 1000;
            _remainingDurationMs = Math.Max(0, totalDuration - elapsed);

            _rotationTimer?.Dispose();
            _rotationTimer = null;
        }

        _logger.LogInformation("Paused with {RemainingMs}ms remaining", _remainingDurationMs);
        EmitStateUpdate();
    }

    public void Resume()
    {
        if (!_isRunning || !_isPaused)
        {
            _logger.LogWarning("Cannot resume: executor not running or not paused (isRunning={IsRunning}, isPaused={IsPaused})", _isRunning, _isPaused);
            return;
        }

        _logger.LogInformation("Resuming playlist");
        _isPaused = false;

        // Resume with remaining duration
        if (_remainingDurationMs > 0)
        {
            _currentItemStartTime = DateTime.Now;
            _rotationTimer = new Timer(_ =>
            {
                try
                {
                    ExecuteNextItem();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in playlist rotation timer");
                }
            }, null, TimeSpan.FromMilliseconds(_remainingDurationMs), Timeout.InfiniteTimeSpan);
            _logger.LogInformation("Resuming with {RemainingMs}ms remaining", _remainingDurationMs);
        }
        else
        {
            // No remaining duration, advance to next item
            ExecuteNextItem();
        }

        EmitStateUpdate();
    }

    public void Next()
    {
        if (!_isRunning)
        {
            _logger.LogWarning("Cannot advance: executor not running");
            return;
        }

        _logger.LogInformation("Advancing to next playlist item");

        // Clear current timeout
        _rotationTimer?.Dispose();
        _rotationTimer = null;

        // If paused, unpause before advancing
        _isPaused = false;

        // Execute next item
        ExecuteNextItem();
        EmitStateUpdate();
    }

    public void Previous()
    {
        if (!_isRunning)
        {
            _logger.LogWarning("Cannot go back: executor not running");
            return;
        }

        _logger.LogInformation("Going back to previous playlist item");

        // Clear current timeout
        _rotationTimer?.Dispose();
        _rotationTimer = null;

        // If paused, unpause before going back
        _isPaused = false;

        // Move back two positions (one to undo the increment from last ExecuteNextItem, one to go back)
        _currentIndex = (_currentIndex - 2 + _playlistItems.Count) % _playlistItems.Count;

        // Execute next item (which is actually the previous item now)
        ExecuteNextItem();
        EmitStateUpdate();
    }

    private void EmitStateUpdate()
    {
        if (_onStateUpdate == null) return;

        // Get current item (the one we're displaying now, which is at index-1 since we increment before displaying)
        var currentItem = _playlistItems.Count > 0 && _currentIndex > 0
            ? _playlistItems[(_currentIndex - 1 + _playlistItems.Count) % _playlistItems.Count]
            : null;

        // Calculate time remaining for current item
        int timeRemaining = 0;
        if (_isRunning && !_isPaused && currentItem != null && _rotationTimer != null)
        {
            var elapsed = (int)(DateTime.Now - _currentItemStartTime).TotalMilliseconds;
            var totalDuration = currentItem.DurationSeconds * 1000;
            timeRemaining = Math.Max(0, totalDuration - elapsed);
        }
        else if (_isPaused)
        {
            timeRemaining = _remainingDurationMs;
        }

        var state = new
        {
            isPlaying = _isRunning,
            isPaused = _isPaused,
            isBroadcasting = false,
            currentItemId = currentItem?.Id,
            currentItemIndex = currentItem != null ? (_currentIndex - 1 + _playlistItems.Count) % _playlistItems.Count : 0,
            playlistId = _currentPlaylistId,
            totalItems = _playlistItems.Count,
            currentUrl = currentItem?.Url,
            timeRemaining = timeRemaining
        };

        _logger.LogDebug("Emitting playback state: running={IsRunning}, paused={IsPaused}, item={ItemId}/{Total}",
            _isRunning, _isPaused, currentItem?.Id, _playlistItems.Count);

        _onStateUpdate(state);
    }

    public void Dispose()
    {
        Stop();
    }
}

public class PlaylistItem
{
    public int Id { get; set; }
    public int PlaylistId { get; set; }
    public int? ContentId { get; set; }
    public string? Url { get; set; }
    public int DurationSeconds { get; set; }
    public int OrderIndex { get; set; }
    public string? TimeWindowStart { get; set; }
    public string? TimeWindowEnd { get; set; }
    public string? DaysOfWeek { get; set; }
}
