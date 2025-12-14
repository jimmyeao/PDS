  import { logger } from './logger';
  import { displayController } from './display';
  import { screenshotManager } from './screenshot';
  import { websocketClient } from './websocket';
  import type { PlaylistItem, PlaybackStateUpdatePayload } from '@kiosk/shared';

  class PlaylistExecutor {
    private playlistItems: PlaylistItem[] = [];
    private currentIndex = 0;
    private timeoutId: NodeJS.Timeout | null = null;
    private isRunning = false;
    private defaultRotationMs = 15000; // Fallback when duration is 0 but rotation is needed

    // Pause/Resume state
    private isPaused = false;
    private pausedAt: number = 0;
    private remainingDuration: number = 0;
    private currentItemStartTime: number = 0;

    // Broadcast state
    private savedPlaylist: PlaylistItem[] = [];
    private savedIndex: number = 0;
    private isBroadcasting = false;

    // Playlist tracking
    private currentPlaylistId: number | null = null;

    public loadPlaylist(items: PlaylistItem[], playlistId?: number): void {
      logger.info(`Loading playlist with ${items.length} items`);

      // Store playlist ID for state reporting
      if (playlistId !== undefined) {
        this.currentPlaylistId = playlistId;
      }

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
      this.isPaused = false;
      this.currentIndex = 0;

      // Screenshot policy:
      // - If single static screen (only one item or duration 0), keep periodic screenshots every 30s
      // - If rotating playlist, disable periodic and capture on each rotation
      if (this.playlistItems.length === 1 || this.playlistItems.some(i => i.displayDuration === 0)) {
        screenshotManager.start();
      } else {
        screenshotManager.stop();
      }

      this.emitStateUpdate();
      this.executeNextItem();
    }

    public stop(): void {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      this.isRunning = false;
      this.isPaused = false;
      logger.info('Playlist executor stopped');
      this.emitStateUpdate();
    }

    public pause(): void {
      if (!this.isRunning || this.isPaused) {
        logger.warn('Cannot pause: executor not running or already paused');
        return;
      }

      logger.info('Pausing playlist');
      this.isPaused = true;
      this.pausedAt = Date.now();

      // Calculate remaining duration for current item
      if (this.timeoutId) {
        const elapsed = this.pausedAt - this.currentItemStartTime;
        const currentItem = this.getCurrentItem();
        const totalDuration = currentItem?.displayDuration || 0;
        this.remainingDuration = Math.max(0, totalDuration - elapsed);

        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      logger.info(`Paused with ${this.remainingDuration}ms remaining`);
      this.emitStateUpdate();
    }

    public resume(): void {
      if (!this.isRunning || !this.isPaused) {
        logger.warn('Cannot resume: executor not running or not paused');
        return;
      }

      logger.info('Resuming playlist');
      this.isPaused = false;

      // Resume with remaining duration
      if (this.remainingDuration > 0) {
        this.currentItemStartTime = Date.now();
        this.timeoutId = setTimeout(() => {
          this.executeNextItem();
        }, this.remainingDuration);
        logger.info(`Resuming with ${this.remainingDuration}ms remaining`);
      } else {
        // No remaining duration, advance to next item
        this.executeNextItem();
      }

      this.emitStateUpdate();
    }

    public next(respectConstraints = true): void {
      if (!this.isRunning) {
        logger.warn('Cannot advance: executor not running');
        return;
      }

      logger.info('Advancing to next playlist item');

      // Clear current timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      // If paused, unpause before advancing
      this.isPaused = false;

      if (respectConstraints) {
        // Use normal constraint-aware navigation
        this.executeNextItem();
      } else {
        // Skip to next item without constraint checking
        if (this.playlistItems.length === 0) return;

        this.currentIndex = (this.currentIndex + 1) % this.playlistItems.length;
        const item = this.playlistItems[(this.currentIndex - 1 + this.playlistItems.length) % this.playlistItems.length];
        this.displayContent(item);

        // Schedule next rotation
        const nextDelay = item.displayDuration > 0 ? item.displayDuration : this.defaultRotationMs;
        this.timeoutId = setTimeout(() => this.executeNextItem(), nextDelay);
      }

      this.emitStateUpdate();
    }

    public previous(respectConstraints = true): void {
      if (!this.isRunning) {
        logger.warn('Cannot go back: executor not running');
        return;
      }

      logger.info('Going back to previous playlist item');

      // Clear current timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      // If paused, unpause before going back
      this.isPaused = false;

      if (respectConstraints) {
        // Search backwards for valid item
        const item = this.getPreviousValidItem();
        if (item) {
          this.displayContent(item);
          const nextDelay = item.displayDuration > 0 ? item.displayDuration : this.defaultRotationMs;
          if (this.playlistItems.length > 1 && nextDelay > 0) {
            this.timeoutId = setTimeout(() => this.executeNextItem(), nextDelay);
          }
        } else {
          logger.warn('No valid previous item found');
          // Continue from current position
          this.executeNextItem();
        }
      } else {
        // Skip to previous item without constraint checking
        if (this.playlistItems.length === 0) return;

        // Go back 2 positions (since currentIndex is already incremented)
        this.currentIndex = (this.currentIndex - 2 + this.playlistItems.length) % this.playlistItems.length;
        const item = this.playlistItems[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.playlistItems.length;
        this.displayContent(item);

        // Schedule next rotation
        const nextDelay = item.displayDuration > 0 ? item.displayDuration : this.defaultRotationMs;
        this.timeoutId = setTimeout(() => this.executeNextItem(), nextDelay);
      }

      this.emitStateUpdate();
    }

    public startBroadcast(url: string, duration = 0): void {
      logger.info(`Starting broadcast: ${url} (duration: ${duration}ms)`);

      // Save current playlist state
      this.savedPlaylist = [...this.playlistItems];
      this.savedIndex = this.currentIndex;
      this.isBroadcasting = true;

      // Clear current timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      // Navigate to broadcast URL
      displayController.navigateTo(url, duration);
      logger.info(`Displaying broadcast URL: ${url}`);

      this.emitStateUpdate();

      // If duration is provided and > 0, auto-end broadcast after duration
      if (duration > 0) {
        setTimeout(() => {
          if (this.isBroadcasting) {
            logger.info('Broadcast duration expired, ending broadcast');
            this.endBroadcast();
          }
        }, duration);
      }
    }

    public endBroadcast(): void {
      if (!this.isBroadcasting) {
        logger.warn('Cannot end broadcast: not broadcasting');
        return;
      }

      logger.info('Ending broadcast, restoring original playlist');

      // Restore saved playlist
      this.playlistItems = [...this.savedPlaylist];
      this.currentIndex = this.savedIndex;
      this.isBroadcasting = false;

      // Restart playlist execution
      if (this.isRunning) {
        this.executeNextItem();
      }

      this.emitStateUpdate();
    }

    public getPlaybackState(): PlaybackStateUpdatePayload {
      const currentItem = this.getCurrentItem();
      const totalItems = this.playlistItems.length;

      // Calculate time remaining for current item
      let timeRemaining: number | null = null;
      if (this.isRunning && !this.isPaused && currentItem) {
        if (this.timeoutId && this.currentItemStartTime > 0) {
          const elapsed = Date.now() - this.currentItemStartTime;
          const totalDuration = currentItem.displayDuration || 0;
          timeRemaining = Math.max(0, totalDuration - elapsed);
        } else if (currentItem.displayDuration === 0) {
          timeRemaining = null; // Static display
        }
      } else if (this.isPaused) {
        timeRemaining = this.remainingDuration;
      }

      return {
        isPlaying: this.isRunning && !this.isPaused,
        isPaused: this.isPaused,
        isBroadcasting: this.isBroadcasting,
        currentItemId: currentItem?.id || null,
        currentItemIndex: currentItem ? (this.currentIndex - 1 + this.playlistItems.length) % this.playlistItems.length : 0,
        playlistId: this.currentPlaylistId,
        totalItems: totalItems,
        currentUrl: currentItem?.content?.url || null,
        timeRemaining: timeRemaining,
      };
    }

    private emitStateUpdate(): void {
      const state = this.getPlaybackState();
      websocketClient.sendPlaybackState(state);
    }

    private isItemValid(item: PlaylistItem): boolean {
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = this.formatTime(now);

      // Check day of week constraint
      if (item.daysOfWeek) {
        const daysOfWeek = JSON.parse(item.daysOfWeek) as number[];
        if (!daysOfWeek.includes(currentDay)) {
          return false;
        }
      }

      // Check time window constraint
      if (item.timeWindowStart && item.timeWindowEnd) {
        if (currentTime < item.timeWindowStart || currentTime > item.timeWindowEnd) {
          return false;
        }
      }

      return true;
    }

    private executeNextItem(): void {
      if (!this.isRunning || this.playlistItems.length === 0 || this.isPaused) {
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

      // Track when this item started
      this.currentItemStartTime = Date.now();

      // Navigate to content
      this.displayContent(item);

      // Emit state update after displaying
      this.emitStateUpdate();

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

    private getPreviousValidItem(): PlaylistItem | null {
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = this.formatTime(now);

      let attempts = 0;
      const maxAttempts = this.playlistItems.length;

      // Go back 2 positions (one to undo the increment, one to go to previous)
      let searchIndex = (this.currentIndex - 2 + this.playlistItems.length) % this.playlistItems.length;

      while (attempts < maxAttempts) {
        const item = this.playlistItems[searchIndex];

        // Check day of week constraint
        if (item.daysOfWeek) {
          const daysOfWeek = JSON.parse(item.daysOfWeek) as number[];
          if (!daysOfWeek.includes(currentDay)) {
            logger.debug(`Previous item ${item.id} skipped: wrong day of week`);
            searchIndex = (searchIndex - 1 + this.playlistItems.length) % this.playlistItems.length;
            attempts++;
            continue;
          }
        }

        // Check time window constraint
        if (item.timeWindowStart && item.timeWindowEnd) {
          if (currentTime < item.timeWindowStart || currentTime > item.timeWindowEnd) {
            logger.debug(`Previous item ${item.id} skipped: outside time window`);
            searchIndex = (searchIndex - 1 + this.playlistItems.length) % this.playlistItems.length;
            attempts++;
            continue;
          }
        }

        // Item is valid
        this.currentIndex = (searchIndex + 1) % this.playlistItems.length;
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
    // Re-emit current playback state (useful after page refresh/navigation)
    public refreshState(): void {
      this.emitStateUpdate();
    }
  }

  export const playlistExecutor = new PlaylistExecutor();