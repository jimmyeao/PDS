import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from './config';
import { logger } from './logger';
import { screenshotManager } from './screenshot';
import { websocketClient } from './websocket';

class DisplayController {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private currentUrl: string = '';
  private isInitialized = false;
  private screencastClient: any | null = null;
  private isScreencastActive = false;
  private lastScreencastFrameAt: number = 0;
  private screencastWatchdogId: NodeJS.Timeout | null = null;
  private frameNavigatedHandler: (() => Promise<void>) | null = null;

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Display controller already initialized');
      return;
    }

    try {
      logger.info('Initializing display controller...');
      logger.info(`Display configuration: ${config.displayWidth}x${config.displayHeight}, Kiosk: ${config.kioskMode}`);

      const profileDir = process.platform === 'win32'
        ? `${process.env.LOCALAPPDATA || 'C:/Users/Public/AppData/Local'}/PDS/browser-profile`
        : '/tmp/kiosk-browser-profile';

      // Ensure profile directory exists so Chromium can persist cookies/sessions
      try {
        const fs = await import('fs');
        const path = await import('path');
        const dirPath = path.resolve(profileDir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          logger.info(`Created browser profile directory: ${dirPath}`);
        } else {
          logger.info(`Using existing browser profile directory: ${dirPath}`);
        }
      } catch (e: any) {
        logger.warn(`Could not ensure profile directory: ${e?.message || e}`);
      }

      const launchOptions: any = {
        headless: false,
        userDataDir: profileDir, // Persist cookies and session data across runs
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-zygote',
          // Enable GPU/WebGL for proper rendering of certain pages/cards
          '--ignore-gpu-blocklist',
          '--enable-webgl',
          '--enable-accelerated-2d-canvas',
          ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
          ...(process.platform === 'linux'
            ? [
                // Raspberry Pi / Linux: prefer EGL + hardware acceleration (X11-compatible)
                '--use-gl=egl',
                '--enable-gpu-rasterization',
                '--enable-zero-copy',
                '--autoplay-policy=no-user-gesture-required',
                // Avoid Wayland-only flags since DISPLAY=:0 indicates X11
              ]
            : []),
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--force-device-scale-factor=1', // Force 1:1 scaling
          '--high-dpi-support=1',
          '--force-color-profile=srgb',
          `--window-size=${config.displayWidth},${config.displayHeight}`,
          `--window-position=0,0`,
          '--new-window',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: null, // Use window size instead of viewport
        env: {
          ...process.env,
          DISPLAY: process.env.DISPLAY || ':0',
        },
      };

      // Use custom Chromium path if provided (e.g., system chromium on Raspberry Pi)
      if (config.puppeteerExecutablePath) {
        launchOptions.executablePath = config.puppeteerExecutablePath;
        logger.info(`Using custom Chromium path: ${config.puppeteerExecutablePath}`);
      }

      // Add kiosk mode args if enabled
      if (config.kioskMode) {
        launchOptions.args.push(
          '--kiosk',
          '--start-fullscreen',
          '--disable-infobars',
          '--disable-session-crashed-bubble'
        );
      }

      this.browser = await puppeteer.launch(launchOptions);
      logger.info('Browser launched successfully');

      this.page = await this.browser.newPage();
      try {
        await this.page.bringToFront();
        await this.page.goto('about:blank');
        await this.page.evaluate(() => {
          // @ts-ignore
          window.focus();
        });
      } catch {}

      // Set viewport to match window size (for screenshots and page rendering)
      await this.page.setViewport({
        width: config.displayWidth,
        height: config.displayHeight,
        deviceScaleFactor: 1,
      });

      logger.info(`Viewport set to: ${config.displayWidth}x${config.displayHeight} with deviceScaleFactor=1`);

      // Log actual browser dimensions and device pixel ratio
      const browserInfo = await this.page.evaluate(() => {
        // @ts-ignore - Code runs in browser context
        return {
          // @ts-ignore
          windowWidth: window.innerWidth,
          // @ts-ignore
          windowHeight: window.innerHeight,
          // @ts-ignore
          screenWidth: window.screen.width,
          // @ts-ignore
          screenHeight: window.screen.height,
          // @ts-ignore
          devicePixelRatio: window.devicePixelRatio,
          // @ts-ignore
          outerWidth: window.outerWidth,
          // @ts-ignore
          outerHeight: window.outerHeight,
        };
      });
      logger.info('Browser dimensions:', JSON.stringify(browserInfo, null, 2));

      // Force zoom to 100% if it's not already
      await this.page.evaluate(() => {
        // @ts-ignore
        document.body.style.zoom = '100%';
      });

      // Hide automation indicators
      await this.page.evaluateOnNewDocument(() => {
        // @ts-ignore - All code runs in browser context
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        // @ts-ignore
        delete (navigator as any).__proto__.webdriver;

        // @ts-ignore
        (globalThis as any).chrome = {
          runtime: {},
        };

        // @ts-ignore
        const originalQuery = (globalThis as any).navigator.permissions.query;
        (globalThis as any).navigator.permissions.query = (parameters: any) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: (globalThis as any).Notification.permission }) :
            originalQuery(parameters)
        );
      });

      logger.info('Page created with viewport set');

      // Set screenshot manager page reference
      screenshotManager.setPage(this.page);

      // Setup page error handlers
      this.setupErrorHandlers();

      // Start live screencast streaming by default
      await this.startScreencast();

      this.isInitialized = true;
      logger.info('✅ Display controller initialized');
    } catch (error: any) {
      logger.error('Failed to initialize display controller:', error.message);
      websocketClient.sendErrorReport(
        'Display initialization failed',
        error.stack
      );
      throw error;
    }
  }

  public async startScreencast(): Promise<void> {
    if (!this.page) {
      logger.warn('Cannot start screencast: page not initialized');
      return;
    }
    if (this.isScreencastActive) {
      logger.info('Screencast already active');
      return;
    }

    try {
      logger.info('Starting CDP screencast for live streaming...');

      // Stop any existing screencast first
      await this.stopScreencast();

      // Get NEW CDP session (recreating fixes disconnection issues)
      const client = await this.page.target().createCDPSession();
      this.screencastClient = client;

      // Add disconnect handler to detect CDP session failures
      client.on('sessiondetached', () => {
        logger.warn('CDP session detached! Will restart on next watchdog check.');
        this.isScreencastActive = false;
        this.screencastClient = null;
      });

      // Ensure Page domain is enabled and lifecycle events are available
      try {
        await client.send('Page.enable');
        await client.send('Page.setLifecycleEventsEnabled', { enabled: true });
      } catch (e: any) {
        logger.warn(`Could not enable Page domain/lifecycle events: ${e?.message || e}`);
      }

      // Start screencast with optimized settings
      await client.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 80,
        maxWidth: config.displayWidth,
        maxHeight: config.displayHeight,
        // Capture every 2nd frame to reduce backpressure and improve reliability
        everyNthFrame: 2,
      });

      let firstFrameReceived = false;

      // Listen for screencast frames
      client.on('Page.screencastFrame', async (frame: any) => {
        try {
          if (!firstFrameReceived) {
            firstFrameReceived = true;
            logger.info('First screencast frame received');
          }
          this.lastScreencastFrameAt = Date.now();
          // Send frame to server via WebSocket
          websocketClient.sendScreencastFrame({
            data: frame.data,
            metadata: {
              sessionId: frame.sessionId,
              timestamp: Date.now(),
              width: frame.metadata.deviceWidth || config.displayWidth,
              height: frame.metadata.deviceHeight || config.displayHeight,
            },
          });

          // Acknowledge frame to continue receiving
          await client.send('Page.screencastFrameAck', {
            sessionId: frame.sessionId,
          });
        } catch (error: any) {
          logger.error('Error handling screencast frame:', error.message);
        }
      });

      // If no frame arrives within 5 seconds, do full restart (recreate session)
      setTimeout(async () => {
        if (!firstFrameReceived) {
          logger.warn('No screencast frames after 5s, doing FULL restart (recreate CDP session)');
          this.isScreencastActive = false;
          await this.startScreencast();
        }
      }, 5000);

      // Start a watchdog that fully restarts screencast if no frames for 10s
      if (this.screencastWatchdogId) {
        clearInterval(this.screencastWatchdogId);
      }
      this.screencastWatchdogId = setInterval(async () => {
        const now = Date.now();
        if (this.isScreencastActive && this.lastScreencastFrameAt && now - this.lastScreencastFrameAt > 10000) {
          logger.warn('Screencast stalled (no frames >10s). Doing FULL restart (recreate CDP session)...');
          this.isScreencastActive = false; // Mark as inactive so startScreencast can run
          await this.startScreencast(); // This will recreate the CDP session
        } else if (!this.isScreencastActive && this.page) {
          // CDP session was detached, restart it
          logger.warn('CDP session not active, restarting...');
          await this.startScreencast();
        }
      }, 5000);

      // Remove old framenavigated handler if exists
      if (this.frameNavigatedHandler && this.page) {
        this.page.off('framenavigated', this.frameNavigatedHandler);
      }

      // Create new handler and store reference
      this.frameNavigatedHandler = async () => {
        try {
          logger.info('Frame navigated, doing FULL screencast restart');
          this.isScreencastActive = false;
          await this.startScreencast();
        } catch (navErr: any) {
          logger.warn(`Could not restart screencast after navigation: ${navErr?.message || navErr}`);
        }
      };

      // Restart screencast on navigation events to recover sessions
      this.page.on('framenavigated', this.frameNavigatedHandler);

      logger.info('✅ Screencast streaming started');
      this.isScreencastActive = true;
    } catch (error: any) {
      logger.error('Failed to start screencast:', error.message);
      websocketClient.sendErrorReport('Screencast start failed', error.stack);
      this.isScreencastActive = false;
    }
  }

  public async stopScreencast(): Promise<void> {
    try {
      if (this.screencastClient) {
        try {
          await this.screencastClient.send('Page.stopScreencast');
        } catch (e: any) {
          logger.warn(`Failed to send Page.stopScreencast: ${e?.message || e}`);
        }

        // Detach CDP session to fully clean up
        try {
          await this.screencastClient.detach();
        } catch (e: any) {
          logger.warn(`Failed to detach CDP session: ${e?.message || e}`);
        }

        this.screencastClient = null;
        logger.info('Screencast stopped and CDP session detached');
      }

      this.isScreencastActive = false;

      if (this.screencastWatchdogId) {
        clearInterval(this.screencastWatchdogId);
        this.screencastWatchdogId = null;
      }

      // Remove framenavigated handler
      if (this.frameNavigatedHandler && this.page) {
        this.page.off('framenavigated', this.frameNavigatedHandler);
        this.frameNavigatedHandler = null;
      }
    } catch (e: any) {
      logger.warn(`Failed to stop screencast: ${e?.message || e}`);
      this.isScreencastActive = false;
      this.screencastClient = null;
    }
  }

  private setupErrorHandlers(): void {
    if (!this.page) return;

    this.page.on('error', (error) => {
      logger.error('Page error:', error.message);
      websocketClient.sendErrorReport('Page error', error.stack);
    });

    this.page.on('pageerror', (error: unknown) => {
      // Filter out common third-party errors that don't affect functionality
      const err = error as Error;
      const errorMessage = err.message.toLowerCase();
      const errorStack = err.stack?.toLowerCase() || '';
      const isNoiseError =
        errorMessage.includes('trustedtypepolicy') ||
        errorMessage.includes('content security policy') ||
        errorMessage.includes('wrongserverexception') ||
        errorMessage.includes('getmastercategorylist') ||
        errorMessage.includes('microsoft.exchange') ||
        errorMessage.includes('cannot read properties of undefined') ||
        errorMessage === 'uncaught exception' ||
        errorStack.includes('trustedtypepolicy') ||
        errorStack.includes('content security') ||
        errorStack.includes('wrongserverexception') ||
        errorStack.includes('microsoft.exchange') ||
        errorStack.includes('adsprebid') ||
        errorStack.includes('prebid') ||
        errorStack.includes('analytics') ||
        errorStack.includes('advertisement') ||
        errorStack.includes('imrworldwide.com');

      if (!isNoiseError) {
        logger.error('Page JavaScript error:', err.message);
        websocketClient.sendErrorReport('Page JavaScript error', err.stack);
      }
    });

    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();

      // Filter out noisy console errors (404s, 403s, CORS errors from third-party resources)
      const isResourceError =
        text.includes('Failed to load resource') ||
        text.includes('status of 404') ||
        text.includes('status of 403') ||
        text.includes('TrustedTypePolicy') ||
        text.includes('Content Security') ||
        text.includes('CORS policy') ||
        text.includes('Access to XMLHttpRequest') ||
        text.includes('Access to fetch') ||
        text.includes('blocked by CORS') ||
        text.includes('No \'Access-Control-Allow-Origin\'');

      // Known benign app-specific console errors to ignore
      const isBenignAppError =
        text.includes('<rect> attribute width: A negative value is not valid') ||
        text.toLowerCase().includes('missing queryfn');

      if (type === 'error' && !isResourceError && !isBenignAppError) {
        logger.error(`Page console error: ${text}`);
      }
    });
  }

  public async navigateTo(url: string, duration?: number): Promise<void> {
    if (!this.page) {
      logger.error('Cannot navigate: page not initialized');
      return;
    }

    try {
      logger.info(`Navigating to: ${url}${duration ? ` (duration: ${duration}ms)` : ''}`);

      // Determine timeout and wait strategy based on URL
      const requiresAuth = url.includes('outlook.') || url.includes('office.com') || url.includes('microsoft.com');
      const timeout = requiresAuth ? 60000 : 30000; // 60s for auth pages, 30s for others

      // Try with networkidle2 first, then fall back to domcontentloaded
      let navigationSuccess = false;

      try {
        await this.page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: timeout,
        });
        navigationSuccess = true;
      } catch (error: any) {
        if (error.message.includes('Navigation timeout') || error.message.includes('Timeout')) {
          logger.warn(`Network idle timeout, retrying with domcontentloaded strategy...`);

          // Retry with more lenient wait strategy
          try {
            await this.page.goto(url, {
              waitUntil: 'domcontentloaded',
              timeout: 15000,
            });
            navigationSuccess = true;
            logger.info('Navigation succeeded with domcontentloaded strategy');
          } catch (retryError: any) {
            logger.warn(`Navigation partially succeeded, continuing anyway: ${retryError.message}`);
            // Continue anyway - page might still be usable even if not fully loaded
            navigationSuccess = true;
          }
        } else {
          throw error; // Re-throw non-timeout errors
        }
      }

      if (!navigationSuccess) {
        throw new Error('Navigation failed after retries');
      }

      // Force page to use full viewport (code runs in browser context via page.evaluate)
      await this.page.evaluate(() => {
        // @ts-ignore
        if (!document.querySelector('meta[name="viewport"]')) {
          // @ts-ignore
          const meta = document.createElement('meta');
          meta.name = 'viewport';
          meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
          // @ts-ignore
          document.head.appendChild(meta);
        }

        // Force body and html to use 100% width/height and remove any scaling
        // @ts-ignore
        if (document.documentElement) {
          // @ts-ignore
          document.documentElement.style.cssText = 'width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden;';
        }
        // @ts-ignore
        if (document.body) {
          // @ts-ignore
          document.body.style.cssText = 'width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: auto; zoom: 100%;';
        }
      });

      // Log page dimensions after navigation
      const pageDimensions = await this.page.evaluate(() => {
        // @ts-ignore - Code runs in browser context
        return {
          // @ts-ignore
          windowWidth: window.innerWidth,
          // @ts-ignore
          windowHeight: window.innerHeight,
          // @ts-ignore
          devicePixelRatio: window.devicePixelRatio,
          // @ts-ignore
          bodyWidth: document.body?.offsetWidth || 0,
          // @ts-ignore
          bodyHeight: document.body?.offsetHeight || 0,
        };
      });
      logger.info(`Page dimensions after navigation: ${JSON.stringify(pageDimensions)}`);

      this.currentUrl = url;
      logger.info(`✅ Navigation successful: ${url}`);

      // On Raspberry Pi/Linux, ensure screencast is active after first successful navigation
      if (!this.isScreencastActive && process.platform === 'linux') {
        logger.info('Ensuring screencast active after navigation (Linux/Pi)');
        await this.startScreencast();
      }

      // If duration is specified, navigate back after timeout
      if (duration) {
        setTimeout(() => {
          logger.info(`Duration ${duration}ms elapsed, ready for next navigation`);
        }, duration);
      }
    } catch (error: any) {
      logger.error(`Navigation failed to ${url}:`, error.message);
      // Only report critical navigation failures; ignore benign aborts caused by redirects or SPA route changes
      const msg = (error.message || '').toLowerCase();
      const isTimeout = msg.includes('navigation timeout') || msg.includes('timeout');
      const isErrAborted = msg.includes('net::err_aborted');
      if (!isTimeout && !isErrAborted) {
        websocketClient.sendErrorReport(
          `Navigation failed to ${url}`,
          error.stack,
          { url }
        );
      }
    }
  }

  public async refresh(force: boolean = false): Promise<void> {
    if (!this.page) {
      logger.error('Cannot refresh: page not initialized');
      return;
    }

    try {
      logger.info(`Refreshing page${force ? ' (hard refresh)' : ''}`);

      await this.page.reload({
        waitUntil: 'networkidle2',
        ...(force && { ignoreCache: true })
      });

      logger.info('✅ Page refreshed');
    } catch (error: any) {
      logger.error('Page refresh failed:', error.message);
      websocketClient.sendErrorReport('Page refresh failed', error.stack);
    }
  }

  public getCurrentUrl(): string {
    return this.currentUrl;
  }

  public getPage(): Page | null {
    return this.page;
  }

  public async restart(): Promise<void> {
    logger.warn('Restarting display controller...');

    await this.shutdown();

    // Wait a bit before reinitializing
    await new Promise(resolve => setTimeout(resolve, 2000));

    await this.initialize();

    logger.info('✅ Display controller restarted');
  }

  public async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down display controller...');

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
        logger.info('Browser closed');
      }
    } catch (error: any) {
      logger.error('Error during shutdown:', error.message);
    }
  }

  // Remote control methods
  public async remoteClick(x: number, y: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
    if (!this.page) {
      logger.warn('Cannot perform remote click: page not initialized');
      return;
    }

    try {
      logger.info(`Remote click at (${x}, ${y}) with ${button} button`);

      await this.page.mouse.click(x, y, { button });

      logger.info('Remote click executed successfully');
    } catch (error: any) {
      logger.error('Error performing remote click:', error.message);
      websocketClient.sendErrorReport('Remote click error', error.stack);
    }
  }

  public async remoteType(text: string, selector?: string): Promise<void> {
    if (!this.page) {
      logger.warn('Cannot perform remote type: page not initialized');
      return;
    }

    try {
      logger.info(`Remote type: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"${selector ? ` in selector: ${selector}` : ''}`);

      if (selector) {
        // Focus on the element first
        await this.page.waitForSelector(selector, { timeout: 5000 });
        await this.page.focus(selector);
        await this.page.keyboard.type(text);
      } else {
        // Check if there's an active element, if not try to find the first input/textarea
        const hasActiveInput = await this.page.evaluate(() => {
          // @ts-ignore - Code runs in browser context
          const active = document.activeElement;
          return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.hasAttribute('contenteditable'));
        });

        if (!hasActiveInput) {
          // Try to focus the first available input/textarea
          const focused = await this.page.evaluate(() => {
            // @ts-ignore - Code runs in browser context
            const input = document.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]');
            if (input) {
              // @ts-ignore
              (input as HTMLElement).focus();
              return true;
            }
            return false;
          });

          if (!focused) {
            logger.warn('No text input found or focused. Click on a text box first.');
            websocketClient.sendErrorReport('Remote type failed', 'No text input focused. User should click on a text box first.');
            return;
          }
        }

        // Type at current focus
        await this.page.keyboard.type(text);
      }

      logger.info('Remote type executed successfully');
    } catch (error: any) {
      logger.error('Error performing remote type:', error.message);
      websocketClient.sendErrorReport('Remote type error', error.stack);
    }
  }

  public async remoteKey(key: string, modifiers?: ('Shift' | 'Control' | 'Alt' | 'Meta')[]): Promise<void> {
    if (!this.page) {
      logger.warn('Cannot perform remote key: page not initialized');
      return;
    }

    try {
      logger.info(`Remote key: ${key}${modifiers ? ` with modifiers: ${modifiers.join('+')}` : ''}`);

      // Press modifiers
      if (modifiers) {
        for (const mod of modifiers) {
          await this.page.keyboard.down(mod);
        }
      }

      // Press the main key as any to bypass type checking
      await this.page.keyboard.press(key as any);

      // Release modifiers
      if (modifiers) {
        for (const mod of modifiers.reverse()) {
          await this.page.keyboard.up(mod);
        }
      }

      logger.info('Remote key executed successfully');
    } catch (error: any) {
      logger.error('Error performing remote key:', error.message);
      websocketClient.sendErrorReport('Remote key error', error.stack);
    }
  }

  public async remoteScroll(x?: number, y?: number, deltaX?: number, deltaY?: number): Promise<void> {
    if (!this.page) {
      logger.warn('Cannot perform remote scroll: page not initialized');
      return;
    }

    try {
      logger.info(`Remote scroll: x=${x}, y=${y}, deltaX=${deltaX}, deltaY=${deltaY}`);

      if (x !== undefined || y !== undefined) {
        // Absolute scroll
        await this.page.evaluate(`window.scrollTo(${x ?? 'window.scrollX'}, ${y ?? 'window.scrollY'})`);
      } else if (deltaX !== undefined || deltaY !== undefined) {
        // Relative scroll
        await this.page.evaluate(`window.scrollBy(${deltaX ?? 0}, ${deltaY ?? 0})`);
      }

      logger.info('Remote scroll executed successfully');
    } catch (error: any) {
      logger.error('Error performing remote scroll:', error.message);
      websocketClient.sendErrorReport('Remote scroll error', error.stack);
    }
  }
}

export const displayController = new DisplayController();
