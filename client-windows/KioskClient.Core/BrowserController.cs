using Microsoft.Playwright;
using System.Text.Json;

namespace KioskClient.Core;

public class BrowserController : IAsyncDisposable
{
    private readonly KioskConfiguration _config;
    private readonly ILogger _logger;
    private IPlaywright? _playwright;
    private IBrowserContext? _browser;  // Changed to IBrowserContext for persistent context
    private IPage? _page;
    private bool _isInitialized;
    private bool _isScreencastActive;
    private Action<string, object>? _onScreencastFrame;
    private Timer? _screencastTimer;
    private string _currentUrl = string.Empty;
    private int _crashCount = 0;
    private const int MaxCrashRetries = 3;
    private int _browserCrashCount = 0;
    private const int MaxBrowserCrashRetries = 5;
    private bool _isRecovering = false;

    public BrowserController(KioskConfiguration config, ILogger logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task InitializeAsync()
    {
        if (_isInitialized)
            return;

        try
        {
            _logger.LogInformation("Initializing Playwright...");

            // Create Playwright instance
            _playwright = await Playwright.CreateAsync();

            // Set up persistent profile directory in ProgramData (system-wide, not user-specific)
            // This ensures it works when running as a Windows Service under SYSTEM account
            var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
            var profileDir = Path.Combine(programData, "TheiaCast", "browser-profile");
            var oldProfileDir = Path.Combine(programData, "PDS", "browser-profile");

            // Migrate old PDS profile to TheiaCast if it exists
            if (!Directory.Exists(profileDir) && Directory.Exists(oldProfileDir))
            {
                try
                {
                    _logger.LogInformation($"Migrating browser profile from PDS to TheiaCast...");
                    var newParentDir = Path.Combine(programData, "TheiaCast");
                    Directory.CreateDirectory(newParentDir);
                    Directory.Move(oldProfileDir, profileDir);
                    _logger.LogInformation($"Browser profile migrated successfully");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Could not migrate old profile: {ex.Message}. Creating new profile.");
                    Directory.CreateDirectory(profileDir);
                }
            }
            else if (!Directory.Exists(profileDir))
            {
                Directory.CreateDirectory(profileDir);
                _logger.LogInformation($"Created browser profile directory: {profileDir}");
            }
            else
            {
                _logger.LogInformation($"Using existing browser profile directory: {profileDir}");
            }

            // Build browser args list
            var args = new List<string>
            {
                "--disable-blink-features=AutomationControlled,WebAuthentication",  // Block automation detection and WebAuthentication at Blink level
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                // CRITICAL: Disable GPU entirely to prevent STATUS_ACCESS_VIOLATION errors
                // GPU/graphics driver issues are the #1 cause of access violations on Windows
                "--disable-gpu",  // Completely disable GPU acceleration
                "--disable-gpu-compositing",  // Disable GPU compositing
                "--disable-software-rasterizer",  // Use CPU rendering instead
                "--disable-features=TranslateUI,WebAuthentication,WebAuth,ClientSideDetectionModel,RendererCodeIntegrity,UseChromeOSDirectVideoDecoder,VizDisplayCompositor",  // Disable features that can cause crashes
                "--enable-features=DefaultPassthroughCommandDecoder",  // Use passthrough command decoder for stability
                "--disable-extensions",
                // Video stability flags to prevent codec crashes
                "--disable-accelerated-video-decode",  // Disable hardware video decoding (prevents video codec crashes)
                "--disable-accelerated-video-encode",  // Disable hardware video encoding
                "--disable-accelerated-2d-canvas",  // Disable 2D canvas acceleration
                // Renderer stability flags to prevent ACCESS_VIOLATION
                "--disable-background-timer-throttling",  // Prevent background throttling issues
                "--disable-renderer-backgrounding",  // Keep renderer active
                "--disable-backgrounding-occluded-windows",  // Don't background hidden windows
                "--disable-ipc-flooding-protection",  // Disable IPC flood protection (can cause crashes)
                "--disable-hang-monitor",  // Disable hang monitor
                // Memory and process stability
                "--js-flags=--max-old-space-size=512",  // Limit JavaScript heap to prevent memory crashes
                "--no-zygote",  // Prevent zygote process crashes on Windows
                "--disable-breakpad",  // Disable crash reporting which can cause STATUS_BREAKPOINT
                "--autoplay-policy=no-user-gesture-required",  // Allow video autoplay
                "--use-mock-keychain",  // Use mock keychain to avoid Windows credential prompts
                "--password-store=basic",  // Use basic password storage, not OS keychain
                $"--window-size={_config.ViewportWidth},{_config.ViewportHeight}"
            };

            // Add kiosk/fullscreen mode flags if enabled
            if (_config.KioskMode)
            {
                args.Add("--kiosk");
                args.Add("--start-fullscreen");
                args.Add("--start-maximized");
            }

            // Launch Chromium browser with persistent profile
            var launchOptions = new BrowserTypeLaunchPersistentContextOptions
            {
                Headless = _config.Headless,
                Args = args.ToArray()
            };

            // Set viewport size only if not in kiosk mode (kiosk mode uses full screen)
            if (!_config.KioskMode)
            {
                launchOptions.ViewportSize = new ViewportSize
                {
                    Width = _config.ViewportWidth,
                    Height = _config.ViewportHeight
                };
            }
            else
            {
                // In kiosk mode, set viewport to null to use full screen
                launchOptions.ViewportSize = ViewportSize.NoViewport;
            }

            _browser = await _playwright.Chromium.LaunchPersistentContextAsync(profileDir, launchOptions);

            _logger.LogInformation("Browser launched with persistent context");

            // Get the first page from the persistent context (or create new one)
            var pages = _browser.Pages;
            if (pages.Count > 0)
            {
                _page = pages[0];
                _logger.LogInformation("Using existing page from persistent context");
            }
            else
            {
                _page = await _browser.NewPageAsync();
                _logger.LogInformation("Created new page in persistent context");
            }

            // Add page crash handler for automatic recovery
            _page.Crash += async (sender, e) =>
            {
                _logger.LogWarning("⚠️ Page crashed! Attempting recovery...");
                _crashCount++;

                if (_crashCount <= MaxCrashRetries && !string.IsNullOrEmpty(_currentUrl))
                {
                    try
                    {
                        _logger.LogInformation("Recovery attempt {CrashCount}/{MaxRetries} - Reloading: {Url}", _crashCount, MaxCrashRetries, _currentUrl);

                        // Wait a moment before reloading
                        await Task.Delay(2000);

                        // Reload the crashed page
                        await NavigateAsync(_currentUrl);

                        _logger.LogInformation("✅ Page recovered successfully");
                        _crashCount = 0; // Reset crash count on successful recovery
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to recover from crash (attempt {CrashCount})", _crashCount);
                    }
                }
                else
                {
                    _logger.LogWarning("Max crash retries ({MaxRetries}) reached or no URL to recover. Manual intervention required.", MaxCrashRetries);
                }
            };

            // Use CDP to disable WebAuthn
            try
            {
                var cdpSession = await _page.Context.NewCDPSessionAsync(_page);
                await cdpSession.SendAsync("WebAuthn.disable");
                _logger.LogInformation("WebAuthn disabled via CDP");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not disable WebAuthn via CDP");
            }

            // Add JavaScript to override navigator.credentials
            await _page.AddInitScriptAsync(@"
                delete navigator.credentials;
                Object.defineProperty(navigator, 'credentials', {
                    get: () => undefined,
                    configurable: false
                });
            ");
            _logger.LogInformation("navigator.credentials overridden");

            _isInitialized = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize browser");
            throw;
        }
    }

    private async Task RecoverBrowserAsync()
    {
        if (_isRecovering)
        {
            _logger.LogWarning("Browser recovery already in progress");
            return;
        }

        _isRecovering = true;
        _browserCrashCount++;

        try
        {
            _logger.LogWarning("🔄 Browser crash detected. Attempting recovery (attempt {Count}/{Max})...", _browserCrashCount, MaxBrowserCrashRetries);

            // Clean up existing browser resources
            try
            {
                if (_page != null)
                {
                    await _page.CloseAsync();
                    _page = null;
                }
            }
            catch { /* Ignore cleanup errors */ }

            try
            {
                if (_browser != null)
                {
                    await _browser.CloseAsync();
                    _browser = null;
                }
            }
            catch { /* Ignore cleanup errors */ }

            try
            {
                _playwright?.Dispose();
                _playwright = null;
            }
            catch { /* Ignore cleanup errors */ }

            // Wait before reinitializing
            await Task.Delay(3000);

            // Mark as not initialized to allow reinitialization
            _isInitialized = false;
            _isScreencastActive = false;

            // Reinitialize browser
            await InitializeAsync();

            // Navigate back to the last URL if we had one
            if (!string.IsNullOrEmpty(_currentUrl))
            {
                _logger.LogInformation("Navigating back to {Url} after recovery", _currentUrl);
                await NavigateAsync(_currentUrl);
            }

            _logger.LogInformation("✅ Browser recovered successfully");
            _browserCrashCount = 0; // Reset on successful recovery
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Browser recovery failed (attempt {Count})", _browserCrashCount);

            if (_browserCrashCount >= MaxBrowserCrashRetries)
            {
                _logger.LogWarning("Max browser recovery attempts ({Max}) reached. Manual intervention required.", MaxBrowserCrashRetries);
            }
        }
        finally
        {
            _isRecovering = false;
        }
    }

    public async Task NavigateAsync(string url)
    {
        if (_page == null)
            throw new InvalidOperationException("Browser not initialized");

        try
        {
            _logger.LogInformation("Navigating to: {Url}", url);

            // Store current URL for crash recovery
            _currentUrl = url;

            // Try with NetworkIdle first (best for complete page loads)
            try
            {
                await _page.GotoAsync(url, new PageGotoOptions
                {
                    Timeout = 30000,
                    WaitUntil = WaitUntilState.NetworkIdle
                });
                _logger.LogInformation("Navigation completed (networkidle)");
                _crashCount = 0; // Reset crash count on successful navigation
            }
            catch (TimeoutException)
            {
                // Fallback to DomContentLoaded if NetworkIdle times out
                _logger.LogWarning("NetworkIdle timeout, falling back to DomContentLoaded");
                await _page.GotoAsync(url, new PageGotoOptions
                {
                    Timeout = 30000,
                    WaitUntil = WaitUntilState.DOMContentLoaded
                });
                _logger.LogInformation("Navigation completed (domcontentloaded)");
                _crashCount = 0; // Reset crash count on successful navigation
            }
        }
        catch (PlaywrightException ex) when (ex.Message.Contains("Page crashed") || ex.Message.Contains("Target crashed"))
        {
            _logger.LogError(ex, "Page crashed during navigation to: {Url}", url);
            // The crash handler will attempt recovery
            throw;
        }
        catch (PlaywrightException ex) when (ex.Message.Contains("Browser") || ex.Message.Contains("Context closed"))
        {
            _logger.LogError(ex, "Fatal browser crash during navigation to: {Url}", url);
            // Attempt browser-level recovery
            await RecoverBrowserAsync();
        }
        catch (Exception ex) when (ex.Message.Contains("STATUS_ACCESS_VIOLATION") ||
                                    ex.Message.Contains("STATUS_BREAKPOINT") ||
                                    ex.Message.Contains("access violation"))
        {
            _logger.LogError(ex, "FATAL: Access violation detected during navigation to: {Url}", url);
            // Attempt browser-level recovery for access violations
            await RecoverBrowserAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Navigation failed: {Url}", url);
            throw;
        }
    }

    public async Task<string> CaptureScreenshotAsync()
    {
        if (_page == null)
            throw new InvalidOperationException("Browser not initialized");

        try
        {
            var screenshot = await _page.ScreenshotAsync(new PageScreenshotOptions
            {
                Type = ScreenshotType.Jpeg,
                Quality = 80,
                FullPage = false
            });

            return Convert.ToBase64String(screenshot);
        }
        catch (PlaywrightException ex) when (ex.Message.Contains("Target crashed") || ex.Message.Contains("Page crashed"))
        {
            _logger.LogWarning("Cannot capture screenshot: page has crashed. Waiting for recovery...");
            throw;
        }
        catch (Exception ex) when (ex.Message.Contains("STATUS_ACCESS_VIOLATION") ||
                                    ex.Message.Contains("Browser") ||
                                    ex.Message.Contains("Context closed"))
        {
            _logger.LogError(ex, "FATAL: Browser crash during screenshot");
            // Trigger browser recovery but don't rethrow - let caller handle
            _ = RecoverBrowserAsync(); // Fire and forget
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to capture screenshot");
            throw;
        }
    }

    public async Task RefreshAsync()
    {
        if (_page == null)
            throw new InvalidOperationException("Browser not initialized");

        await _page.ReloadAsync();
    }

    public async Task ClickAsync(int x, int y, string button = "left")
    {
        if (_page == null)
            throw new InvalidOperationException("Browser not initialized");

        try
        {
            var mouseButton = button.ToLower() switch
            {
                "right" => MouseButton.Right,
                "middle" => MouseButton.Middle,
                _ => MouseButton.Left
            };

            await _page.Mouse.ClickAsync(x, y, new MouseClickOptions { Button = mouseButton });
            _logger.LogDebug("Clicked at ({X}, {Y}) with {Button} button", x, y, button);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to click at ({X}, {Y})", x, y);
        }
    }

    public async Task TypeAsync(string text, string? selector = null)
    {
        if (_page == null)
            throw new InvalidOperationException("Browser not initialized");

        try
        {
            if (!string.IsNullOrEmpty(selector))
            {
                await _page.FocusAsync(selector);
            }

            await _page.Keyboard.TypeAsync(text);
            _logger.LogDebug("Typed text: {Text}", text.Length > 50 ? text[..50] + "..." : text);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to type text");
        }
    }

    public async Task PressKeyAsync(string key)
    {
        if (_page == null)
            throw new InvalidOperationException("Browser not initialized");

        try
        {
            await _page.Keyboard.PressAsync(key);
            _logger.LogDebug("Pressed key: {Key}", key);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to press key: {Key}", key);
        }
    }

    public async Task ScrollAsync(int x, int y)
    {
        if (_page == null)
            throw new InvalidOperationException("Browser not initialized");

        try
        {
            await _page.EvaluateAsync($"window.scrollTo({x}, {y})");
            _logger.LogDebug("Scrolled to ({X}, {Y})", x, y);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to scroll to ({X}, {Y})", x, y);
        }
    }

    public string GetCurrentUrl()
    {
        return _page?.Url ?? string.Empty;
    }

    public void SetScreencastFrameHandler(Action<string, object> handler)
    {
        _onScreencastFrame = handler;
    }

    public async Task StartScreencastAsync()
    {
        if (_page == null)
        {
            _logger.LogWarning("Cannot start screencast: page not initialized");
            return;
        }

        if (_isScreencastActive)
        {
            _logger.LogInformation("Screencast already active");
            return;
        }

        try
        {
            _logger.LogInformation("Starting screencast (polling mode)...");

            _isScreencastActive = true;

            // Use timer-based polling for now (simpler than CDP)
            // Capture frame every ~100ms for ~10 FPS
            _screencastTimer = new Timer(async _ =>
            {
                if (_isScreencastActive && _page != null && _onScreencastFrame != null)
                {
                    try
                    {
                        var screenshot = await _page.ScreenshotAsync(new PageScreenshotOptions
                        {
                            Type = ScreenshotType.Jpeg,
                            Quality = 60,
                            FullPage = false
                        });

                        var base64 = Convert.ToBase64String(screenshot);
                        var metadata = new
                        {
                            sessionId = 1,
                            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                            width = _config.ViewportWidth,
                            height = _config.ViewportHeight
                        };

                        _onScreencastFrame(base64, metadata);
                    }
                    catch
                    {
                        // Ignore screenshot errors during streaming
                    }
                }
            }, null, TimeSpan.FromMilliseconds(100), TimeSpan.FromMilliseconds(100));

            _logger.LogInformation("✅ Screencast started successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start screencast");
            _isScreencastActive = false;
        }
    }

    public async Task StopScreencastAsync()
    {
        if (!_isScreencastActive)
        {
            return;
        }

        try
        {
            _logger.LogInformation("Stopping screencast...");
            _screencastTimer?.Dispose();
            _screencastTimer = null;
            _isScreencastActive = false;
            _logger.LogInformation("Screencast stopped");
            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error stopping screencast");
        }
    }

    public async ValueTask DisposeAsync()
    {
        // Stop screencast if active
        if (_isScreencastActive)
        {
            await StopScreencastAsync();
        }

        if (_page != null)
        {
            await _page.CloseAsync();
        }

        if (_browser != null)
        {
            await _browser.CloseAsync();
        }

        _playwright?.Dispose();
    }
}
