import { logger } from './logger';
import { displayController } from './display';
import { screenshotManager } from './screenshot';
import type { PlaylistItem } from '@kiosk/shared';

class PlaylistExecutor {
  private playlistItems: PlaylistItem[] = [];
  private currentIndex = 0;
  private timeoutId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private defaultRotationMs = 15000; // Fallback when duration is 0 but rotation is needed

  public loadPlaylist(items: PlaylistItem[]): void {
    logger.info(`Loading playlist with ${items.length} items`);

    // Sort items by orderIndex
    this.playlistItems = items.sort((a, b) => a.orderIndex - b.orderIndex);

    logger.debug('Playlist items loaded:', this.playlistItems.map(i => ({
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
      logger.warn('Playlist executor already running');
      return;
    }

    if (this.playlistItems.length === 0) {
      logger.warn('Cannot start playlist executor: no playlist items loaded');
      return;
    }

    logger.info('Starting playlist executor');
    this.isRunning = true;
    this.currentIndex = 0;

    // Screenshot policy:
    // - If single static screen (only one item or duration 0), keep periodic screenshots every 30s
    // - If rotating playlist, disable periodic and capture on each rotation
    if (this.playlistItems.length === 1 || this.playlistItems.some(i => i.displayDuration === 0)) {
      screenshotManager.start();
    } else {
      screenshotManager.stop();
    }

    this.executeNextItem();
  }

  public stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.isRunning = false;
    logger.info('Playlist executor stopped');
  }

  private executeNextItem(): void {
    if (!this.isRunning || this.playlistItems.length === 0) {
      return;
    }

    // Find next valid item to display
    const item = this.getNextValidItem();

    if (!item) {
      logger.warn('No valid playlist items to display at this time');
      // Retry after 1 minute
      this.timeoutId = setTimeout(() => this.executeNextItem(), 60000);
      return;
    }

    logger.info(`Executing playlist item ${item.id} (content: ${item.contentId})`);

    // Navigate to content
    this.displayContent(item);

    // Determine next rotation timing
    let nextDelay = item.displayDuration;

    // If duration is 0 but we have multiple items, use a sensible default to avoid getting stuck
    if (nextDelay === 0 && this.playlistItems.length > 1) {
      nextDelay = this.defaultRotationMs;
      logger.warn(
        `Item duration is 0 but playlist has ${this.playlistItems.length} items; using default rotation ${this.defaultRotationMs}ms`
      );
    }

    // If only one item, display it permanently without rotation
    if (this.playlistItems.length === 1 || nextDelay === 0) {
      logger.info('Displaying permanently without rotation');
      return;
    }

    this.timeoutId = setTimeout(() => {
      this.executeNextItem();
    }, nextDelay);
  }

  private getNextValidItem(): PlaylistItem | null {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentTime = this.formatTime(now);

    let attempts = 0;
    const maxAttempts = this.playlistItems.length;

    while (attempts < maxAttempts) {
      const item = this.playlistItems[this.currentIndex];

      // Check day of week constraint
      if (item.daysOfWeek) {
        const daysOfWeek = JSON.parse(item.daysOfWeek) as number[];
        if (!daysOfWeek.includes(currentDay)) {
          logger.debug(`Item ${item.id} skipped: wrong day of week`);
          this.currentIndex = (this.currentIndex + 1) % this.playlistItems.length;
          attempts++;
          continue;
        }
      }

      // Check time window constraint
      if (item.timeWindowStart && item.timeWindowEnd) {
        if (currentTime < item.timeWindowStart || currentTime > item.timeWindowEnd) {
          logger.debug(`Item ${item.id} skipped: outside time window`);
          this.currentIndex = (this.currentIndex + 1) % this.playlistItems.length;
          attempts++;
          continue;
        }
      }

      // Item is valid
      this.currentIndex = (this.currentIndex + 1) % this.playlistItems.length;
      return item;
    }

    return null;
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private async displayContent(item: PlaylistItem): Promise<void> {
    try {
      if (!item.content || !item.content.url) {
        logger.error(`Playlist item ${item.id} missing content URL`);
        return;
      }

      const url = item.content.url;

      await displayController.navigateTo(url, item.displayDuration);

      // Capture a screenshot on first display and each rotation step for rotating playlists
      if (this.playlistItems.length > 1 && item.displayDuration !== 0) {
        await screenshotManager.captureAndSendScreenshot();
      } else if (this.playlistItems.length === 1 || item.displayDuration === 0) {
        // Ensure periodic screenshots are running for static screens
        screenshotManager.start();
      }

      if (item.displayDuration === 0) {
        logger.info(`✅ Displaying content ${item.contentId} (${item.content.name}) permanently (duration: 0)`);
      } else {
        logger.info(`✅ Displaying content ${item.contentId} (${item.content.name}) for ${item.displayDuration}ms`);
      }
    } catch (error: any) {
      logger.error(`Failed to display content ${item.contentId}:`, error.message);
    }
  }

  public getCurrentItem(): PlaylistItem | null {
    if (this.playlistItems.length === 0) {
      return null;
    }

    const prevIndex = (this.currentIndex - 1 + this.playlistItems.length) % this.playlistItems.length;
    return this.playlistItems[prevIndex];
  }

  public getPlaylistItems(): PlaylistItem[] {
    return [...this.playlistItems];
  }

  public hasPlaylist(): boolean {
    return this.playlistItems.length > 0;
  }
}

export const playlistExecutor = new PlaylistExecutor();
