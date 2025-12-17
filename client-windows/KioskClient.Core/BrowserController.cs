using Microsoft.Playwright;

namespace KioskClient.Core;

public class BrowserController : IAsyncDisposable
{
    private readonly KioskConfiguration _config;
    private readonly ILogger _logger;
    private IPlaywright? _playwright;
    private IBrowser? _browser;
    private IPage? _page;
    private bool _isInitialized;

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

            // Launch Chromium browser
            _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
            {
                Headless = _config.Headless,
                Args = new[]
                {
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                    "--disable-gpu",
                    "--disable-software-rasterizer",
                    "--disable-extensions",
                    "--disable-setuid-sandbox",
                    $"--window-size={_config.ViewportWidth},{_config.ViewportHeight}"
                }
            });

            _logger.LogInformation("Browser launched");

            // Create new page
            _page = await _browser.NewPageAsync(new BrowserNewPageOptions
            {
                ViewportSize = new ViewportSize
                {
                    Width = _config.ViewportWidth,
                    Height = _config.ViewportHeight
                }
            });

            _logger.LogInformation("Page created");

            _isInitialized = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize browser");
            throw;
        }
    }

    public async Task NavigateAsync(string url)
    {
        if (_page == null)
            throw new InvalidOperationException("Browser not initialized");

        try
        {
            _logger.LogInformation("Navigating to: {Url}", url);
            await _page.GotoAsync(url, new PageGotoOptions
            {
                Timeout = 30000,
                WaitUntil = WaitUntilState.NetworkIdle
            });
            _logger.LogInformation("Navigation completed");
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

    public async ValueTask DisposeAsync()
    {
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
