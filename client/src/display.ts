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

      const launchOptions: any = {
        headless: false,
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
          `--window-size=${config.displayWidth},${config.displayHeight}`,
        ],
        ignoreDefaultArgs: ['--enable-automation'],
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
      await this.page.setViewport({
        width: config.displayWidth,
        height: config.displayHeight,
        deviceScaleFactor: 1,
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

    this.page.on('pageerror', (error) => {
      // Filter out common third-party errors that don't affect functionality
      const errorMessage = error.message.toLowerCase();
      const errorStack = error.stack?.toLowerCase() || '';
      const isNoiseError =
        errorMessage.includes('trustedtypepolicy') ||
        errorMessage.includes('content security policy') ||
        errorMessage.includes('wrongserverexception') ||
        errorMessage.includes('getmastercategorylist') ||
        errorMessage.includes('microsoft.exchange') ||
        errorMessage === 'uncaught exception' ||
        errorStack.includes('trustedtypepolicy') ||
        errorStack.includes('content security') ||
        errorStack.includes('wrongserverexception') ||
        errorStack.includes('microsoft.exchange');

      if (!isNoiseError) {
        logger.error('Page JavaScript error:', error.message);
        websocketClient.sendErrorReport('Page JavaScript error', error.stack);
      }
    });

    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();

      // Filter out noisy console errors (404s, 403s from third-party resources)
      const isResourceError =
        text.includes('Failed to load resource') ||
        text.includes('status of 404') ||
        text.includes('status of 403') ||
        text.includes('TrustedTypePolicy') ||
        text.includes('Content Security');

      if (type === 'error' && !isResourceError) {
        logger.error(`Page console error: ${text}`);
      } else if (type === 'warning' && !isResourceError) {
        logger.warn(`Page console warning: ${text}`);
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

      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

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
      });

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
      websocketClient.sendErrorReport(
        `Navigation failed to ${url}`,
        error.stack,
        { url }
      );
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
