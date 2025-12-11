import { logger } from './logger';
import { displayController } from './display';
import type { ScheduleItem } from '@kiosk/shared';

class Scheduler {
  private scheduleItems: ScheduleItem[] = [];
  private currentIndex = 0;
  private timeoutId: NodeJS.Timeout | null = null;
  private isRunning = false;

  public loadSchedule(items: ScheduleItem[]): void {
    logger.info(`Loading schedule with ${items.length} items`);

    // Sort items by orderIndex
    this.scheduleItems = items.sort((a, b) => a.orderIndex - b.orderIndex);

    logger.debug('Schedule items loaded:', this.scheduleItems.map(i => ({
      id: i.id,
      contentId: i.contentId,
      duration: i.displayDuration,
      order: i.orderIndex,
    })));

    // Restart execution if already running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  public start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    if (this.scheduleItems.length === 0) {
      logger.warn('Cannot start scheduler: no schedule items loaded');
      return;
    }

    logger.info('Starting scheduler');
    this.isRunning = true;
    this.currentIndex = 0;
    this.executeNextItem();
  }

  public stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  private executeNextItem(): void {
    if (!this.isRunning || this.scheduleItems.length === 0) {
      return;
    }

    // Find next valid item to display
    const item = this.getNextValidItem();

    if (!item) {
      logger.warn('No valid schedule items to display at this time');
      // Retry after 1 minute
      this.timeoutId = setTimeout(() => this.executeNextItem(), 60000);
      return;
    }

    logger.info(`Executing schedule item ${item.id} (content: ${item.contentId})`);

    // Navigate to content
    this.displayContent(item);

    // Schedule next item
    this.timeoutId = setTimeout(() => {
      this.executeNextItem();
    }, item.displayDuration);
  }

  private getNextValidItem(): ScheduleItem | null {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentTime = this.formatTime(now);

    let attempts = 0;
    const maxAttempts = this.scheduleItems.length;

    while (attempts < maxAttempts) {
      const item = this.scheduleItems[this.currentIndex];

      // Check day of week constraint
      if (item.daysOfWeek) {
        const daysOfWeek = JSON.parse(item.daysOfWeek) as number[];
        if (!daysOfWeek.includes(currentDay)) {
          logger.debug(`Item ${item.id} skipped: wrong day of week`);
          this.currentIndex = (this.currentIndex + 1) % this.scheduleItems.length;
          attempts++;
          continue;
        }
      }

      // Check time window constraint
      if (item.timeWindowStart && item.timeWindowEnd) {
        if (currentTime < item.timeWindowStart || currentTime > item.timeWindowEnd) {
          logger.debug(`Item ${item.id} skipped: outside time window`);
          this.currentIndex = (this.currentIndex + 1) % this.scheduleItems.length;
          attempts++;
          continue;
        }
      }

      // Item is valid
      this.currentIndex = (this.currentIndex + 1) % this.scheduleItems.length;
      return item;
    }

    return null;
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private async displayContent(item: ScheduleItem): Promise<void> {
    try {
      if (!item.content || !item.content.url) {
        logger.error(`Schedule item ${item.id} missing content URL`);
        return;
      }

      const url = item.content.url;

      await displayController.navigateTo(url, item.displayDuration);

      logger.info(`✅ Displaying content ${item.contentId} (${item.content.name}) for ${item.displayDuration}ms`);
    } catch (error: any) {
      logger.error(`Failed to display content ${item.contentId}:`, error.message);
    }
  }

  public getCurrentItem(): ScheduleItem | null {
    if (this.scheduleItems.length === 0) {
      return null;
    }

    const prevIndex = (this.currentIndex - 1 + this.scheduleItems.length) % this.scheduleItems.length;
    return this.scheduleItems[prevIndex];
  }

  public getScheduleItems(): ScheduleItem[] {
    return [...this.scheduleItems];
  }

  public hasSchedule(): boolean {
    return this.scheduleItems.length > 0;
  }
}

export const scheduler = new Scheduler();
