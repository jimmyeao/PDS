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

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Display controller already initialized');
      return;
    }

    try {
      logger.info('Initializing display controller...');
      logger.info(`Display configuration: ${config.displayWidth}x${config.displayHeight}, Kiosk: ${config.kioskMode}`);

      const launchOptions: any = {
        headless: false,
        userDataDir: '/tmp/kiosk-browser-profile', // Persist cookies and session data
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
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
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: null, // Use window size instead of viewport
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

      if (type === 'error' && !isResourceError) {
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

      // If duration is specified, navigate back after timeout
      if (duration) {
        setTimeout(() => {
          logger.info(`Duration ${duration}ms elapsed, ready for next navigation`);
        }, duration);
      }
    } catch (error: any) {
      logger.error(`Navigation failed to ${url}:`, error.message);
      // Only report critical navigation failures, not timeouts that we handled
      if (!error.message.includes('Navigation timeout')) {
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
}

export const displayController = new DisplayController();
