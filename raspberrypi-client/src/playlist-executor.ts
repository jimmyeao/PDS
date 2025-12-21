  import { logger } from './logger';
  import { displayController } from './display';
  import { screenshotManager } from './screenshot';
  import { websocketClient } from './websocket';
  import { contentCacheManager } from './content-cache';
  import * as path from 'path';
  import type { PlaylistItem, PlaybackStateUpdatePayload } from '@theiacast/shared';

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

    // Periodic state emission to keep admin UI in sync
    private stateEmissionIntervalId: NodeJS.Timeout | null = null;

    public async loadPlaylist(items: PlaylistItem[], playlistId?: number): Promise<void> {
      logger.info(`Loading playlist with ${items.length} items`);

      // Store playlist ID for state reporting
      if (playlistId !== undefined) {
        this.currentPlaylistId = playlistId;
      }

      // Sync content to local cache (background)
      contentCacheManager.syncPlaylist(items).catch(e => {
        logger.error(`Failed to trigger playlist sync: ${e.message}`);
      });

      // Store old playlist for comparison
      const oldPlaylist = [...this.playlistItems];
      const wasRunning = this.isRunning;

      // Sort items by orderIndex
      this.playlistItems = items.sort((a, b) => a.orderIndex - b.orderIndex);

      logger.debug('Playlist items loaded:', this.playlistItems.map(i => ({
        id: i.id,
        contentId: i.contentId,
        duration: i.displayDuration,
        order: i.orderIndex,
      })));

      // Restart execution if already running
      if (wasRunning) {
        // Check if we need to restart:
        // - If the current item being displayed is still in the new playlist, don't restart
        // - If it's a single permanent item (duration 0) and it hasn't changed, don't restart
        const currentItem = this.getCurrentItem();
        const currentStillExists = currentItem && this.playlistItems.some(i => i.id === currentItem.id);
        const isPermanentDisplay = this.playlistItems.length === 1 && this.playlistItems[0].displayDuration === 0;
        const wasPermanentDisplay = oldPlaylist.length === 1 && oldPlaylist[0]?.displayDuration === 0;
        const sameContent = isPermanentDisplay && wasPermanentDisplay &&
                            this.playlistItems[0].id === oldPlaylist[0].id;

        if (sameContent) {
          logger.info('Permanent display item unchanged - no restart needed');
          return;
        }

        if (currentStillExists && !isPermanentDisplay) {
          logger.info('Current item still in playlist - updating playlist without restart');
          // Just update the screenshot policy
          if (this.playlistItems.length === 1 || this.playlistItems.some(i => i.displayDuration === 0)) {
            screenshotManager.start();
          } else {
            screenshotManager.stop();
          }
          return;
        }

        logger.info('Playlist changed significantly - restarting executor');
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

      // Start periodic state emission (every 5 seconds) to keep admin UI in sync
      // This ensures controls reappear after admin dashboard refresh
      this.stateEmissionIntervalId = setInterval(() => {
        this.emitStateUpdate();
      }, 5000);

      this.emitStateUpdate();
      this.executeNextItem();
    }

    public stop(): void {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      if (this.stateEmissionIntervalId) {
        clearInterval(this.stateEmissionIntervalId);
        this.stateEmissionIntervalId = null;
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

    public startBroadcast(type: 'url' | 'message', url?: string, message?: string, duration = 0): void {
      logger.info(`Starting broadcast (${type}): ${url || message} (duration: ${duration}ms)`);

      // Save current playlist state
      this.savedPlaylist = [...this.playlistItems];
      this.savedIndex = this.currentIndex;
      this.isBroadcasting = true;

      // Clear current timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      if (type === 'url' && url) {
        // Navigate to broadcast URL
        displayController.navigateTo(url, duration);
        logger.info(`Displaying broadcast URL: ${url}`);
      } else if (type === 'message' && message) {
        // Create a simple HTML page to display the message
        const messageHtml = `data:text/html;charset=utf-8,${encodeURIComponent(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Broadcast Message</title>
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                }
                .message-container {
                  background: white;
                  border-radius: 20px;
                  padding: 60px 80px;
                  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                  max-width: 80%;
                  text-align: center;
                }
                .message-text {
                  font-size: 48px;
                  font-weight: 600;
                  color: #2d3748;
                  line-height: 1.4;
                  white-space: pre-wrap;
                  word-wrap: break-word;
                }
                .broadcast-label {
                  font-size: 18px;
                  color: #667eea;
                  text-transform: uppercase;
                  letter-spacing: 2px;
                  margin-bottom: 30px;
                  font-weight: 700;
                }
              </style>
            </head>
            <body>
              <div class="message-container">
                <div class="broadcast-label">Broadcast Message</div>
                <div class="message-text">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              </div>
            </body>
          </html>
        `)}`;
        displayController.navigateTo(messageHtml, duration);
        logger.info(`Displaying broadcast message: ${message}`);
      }

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
      if (this.playlistItems.length === 1 && nextDelay === 0) {
        logger.info('Displaying permanently without rotation');
        return;
      }

      // If only one item but has duration (e.g. video), loop it
      if (this.playlistItems.length === 1 && nextDelay > 0) {
         logger.info(`Single item with duration ${nextDelay}ms - scheduling loop`);
         // Force reload for single item video loops
         this.currentIndex = (this.currentIndex - 1 + this.playlistItems.length) % this.playlistItems.length;
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

        let url = item.content.url;

        // Wait for cacheable content (videos) to be ready
        if (contentCacheManager.isCacheable(url)) {
          logger.info(`Waiting for video to be cached: ${url}`);
          const cachedPath = await contentCacheManager.waitForCache(url, 300000); // 5 minute timeout

          if (cachedPath) {
            // Convert to file URL
            const absolutePath = path.resolve(cachedPath).replace(/\\/g, '/');
            url = `file:///${absolutePath}`;
            logger.info(`✅ Video ready in cache, using local file: ${url}`);
          } else {
            logger.warn(`Video caching failed or timed out, will attempt to play from remote URL: ${url}`);
          }
        } else {
          // Check if we have a local cached version (for non-videos)
          const localPath = contentCacheManager.getLocalPath(url);
          if (localPath) {
            const absolutePath = path.resolve(localPath).replace(/\\/g, '/');
            url = `file:///${absolutePath}`;
            logger.info(`Using cached content: ${url}`);
          }
        }

        await displayController.navigateTo(url, item.displayDuration);

        // Capture a single screenshot after content has loaded
        // We wait 4 seconds to allow videos to start playing or pages to render
        setTimeout(async () => {
            try {
                await screenshotManager.captureAndSendScreenshot();
            } catch (e) {
                logger.warn('Failed to capture navigation screenshot');
            }
        }, 4000);

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