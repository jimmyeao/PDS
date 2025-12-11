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
          `--window-size=${config.displayWidth},${config.displayHeight}`,
        ],
      };

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
      logger.error('Page JavaScript error:', error.message);
      websocketClient.sendErrorReport('Page JavaScript error', error.stack);
    });

    this.page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error') {
        logger.error(`Page console error: ${msg.text()}`);
      } else if (type === 'warning') {
        logger.warn(`Page console warning: ${msg.text()}`);
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
