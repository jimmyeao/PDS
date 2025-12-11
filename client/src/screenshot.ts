import { Page } from 'puppeteer';
import { config } from './config';
import { logger } from './logger';
import { websocketClient } from './websocket';

class ScreenshotManager {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private page: Page | null = null;

  public setPage(page: Page): void {
    this.page = page;
    logger.debug('Screenshot manager page reference set');
  }

  public start(): void {
    if (this.isRunning) {
      logger.warn('Screenshot manager already running');
      return;
    }

    if (!this.page) {
      logger.warn('Cannot start screenshot manager: no page reference set');
      return;
    }

    logger.info(`Starting screenshot manager (interval: ${config.screenshotInterval}ms)`);
    this.isRunning = true;

    // Take initial screenshot after a delay
    setTimeout(() => {
      this.captureAndSendScreenshot();
    }, 10000);

    // Schedule periodic screenshots
    this.intervalId = setInterval(() => {
      this.captureAndSendScreenshot();
    }, config.screenshotInterval);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('Screenshot manager stopped');
    }
  }

  public async captureAndSendScreenshot(): Promise<void> {
    if (!this.page) {
      logger.warn('Cannot capture screenshot: no page reference');
      return;
    }

    try {
      logger.debug('Capturing screenshot...');

      const screenshot = await this.page.screenshot({
        encoding: 'base64',
        type: 'jpeg',
        quality: 75,
        fullPage: false,
      });

      const currentUrl = this.page.url();

      websocketClient.sendScreenshot(screenshot as string, currentUrl);
      logger.info('Screenshot captured and sent');
    } catch (error: any) {
      logger.error('Failed to capture screenshot:', error.message);
      websocketClient.sendErrorReport(
        'Screenshot capture failed',
        error.stack,
        { url: this.page.url() }
      );
    }
  }

  public async captureOnDemand(): Promise<void> {
    logger.info('On-demand screenshot requested');
    await this.captureAndSendScreenshot();
  }
}

export const screenshotManager = new ScreenshotManager();
