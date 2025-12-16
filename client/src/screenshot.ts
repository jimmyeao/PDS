import { Page } from 'puppeteer';
import { config } from './config';
import { logger } from './logger';
import { websocketClient } from './websocket';

class ScreenshotManager {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private page: Page | null = null;
  private lastUrl: string | null = null;
  private lastSentAt: number = 0;

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

    // Take initial screenshot after a short delay
    setTimeout(() => {
      this.captureAndSendScreenshot();
    }, 5000);

    // Schedule periodic screenshots (fallback cadence)
    this.intervalId = setInterval(() => {
      const now = Date.now();
      // Only send periodic screenshot if at least screenshotInterval has elapsed
      if (now - this.lastSentAt >= config.screenshotInterval) {
        this.captureAndSendScreenshot();
      }
    }, Math.min(config.screenshotInterval, 5000));
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
      const currentUrl = this.page.url();

      // Change-triggered capture: if URL changed since last capture, send immediately
      const urlChanged = this.lastUrl !== currentUrl;

      // Throttle rapid repeats: avoid >1/sec even on fast changes
      const now = Date.now();
      if (!urlChanged && now - this.lastSentAt < 900) {
        logger.debug('Skipping screenshot: recently sent');
        return;
      }

      logger.debug('Capturing screenshot...');

      const screenshot = await this.page.screenshot({
        encoding: 'base64',
        type: 'jpeg',
        quality: 50, // Reduced quality to save bandwidth
        fullPage: false,
      });

      websocketClient.sendScreenshot(screenshot as string, currentUrl);
      this.lastUrl = currentUrl;
      this.lastSentAt = now;
      logger.info(`Screenshot captured and sent (${urlChanged ? 'url change' : 'periodic'})`);
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
