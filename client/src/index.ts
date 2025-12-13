#!/usr/bin/env node

import { config, configManager } from './config';
import { logger } from './logger';
import { websocketClient, DeviceStatusValues } from './websocket';
import { displayController } from './display';
import { healthMonitor } from './health';
import { screenshotManager } from './screenshot';
import { playlistExecutor } from './playlist-executor';

class KioskClient {
  private isShuttingDown = false;

  public async start(): Promise<void> {
    try {
      logger.info('===========================================');
      logger.info('  Kiosk Digital Signage Client Starting');
      logger.info('===========================================');
      logger.info(`Server URL: ${config.serverUrl}`);
      logger.info(`Display: ${config.displayWidth}x${config.displayHeight}`);
      logger.info(`Kiosk Mode: ${config.kioskMode ? 'Enabled' : 'Disabled'}`);
      logger.info('===========================================');

      // Setup signal handlers for graceful shutdown
      this.setupSignalHandlers();

      // Initialize display controller
      await displayController.initialize();

      // Connect to backend via WebSocket
      this.setupWebSocketHandlers();
      websocketClient.connect();

      // Start health monitoring
      healthMonitor.start();

      // Start screenshot manager
      screenshotManager.start();

      logger.info('✅ Kiosk client started successfully');
      logger.info('Waiting for playlist from server...');
    } catch (error: any) {
      logger.error('Failed to start kiosk client:', error.message);
      logger.error(error.stack);
      process.exit(1);
    }
  }

  private setupWebSocketHandlers(): void {
    // Content update handler
    websocketClient.onContentUpdate((payload) => {
      logger.info(`Received content update with ${payload.items.length} items`);
      playlistExecutor.loadPlaylist(payload.items);
      playlistExecutor.start();
    });

    // Display navigate handler
    websocketClient.onDisplayNavigate((payload) => {
      logger.info(`Navigating to: ${payload.url}`);
      displayController.navigateTo(payload.url, payload.duration);
    });

    // Screenshot request handler
    websocketClient.onScreenshotRequest((payload) => {
      logger.info('Screenshot requested by server');
      screenshotManager.captureOnDemand();
    });

    // Config update handler
    websocketClient.onConfigUpdate((payload) => {
      logger.info('Configuration update received', payload);

      // Update config with new values
      if (payload.screenshotInterval) {
        configManager.update({ screenshotInterval: payload.screenshotInterval });
        screenshotManager.stop();
        screenshotManager.start();
      }

      if (payload.healthCheckInterval) {
        configManager.update({ healthCheckInterval: payload.healthCheckInterval });
        healthMonitor.stop();
        healthMonitor.start();
      }
    });

    // Device restart handler
    websocketClient.onDeviceRestart((payload) => {
      logger.warn('Device restart requested by server', payload);
      this.restart();
    });

    // Display refresh handler
    websocketClient.onDisplayRefresh((payload) => {
      logger.info('Display refresh requested', payload);
      displayController.refresh(payload.force);
    });

    // Remote control handlers
    websocketClient.onRemoteClick((payload) => {
      logger.info(`Remote click at (${payload.x}, ${payload.y})`);
      displayController.remoteClick(payload.x, payload.y, payload.button);
    });

    websocketClient.onRemoteType((payload) => {
      logger.info(`Remote type: ${payload.text.substring(0, 20)}...`);
      displayController.remoteType(payload.text, payload.selector);
    });

    websocketClient.onRemoteKey((payload) => {
      logger.info(`Remote key: ${payload.key}`);
      displayController.remoteKey(payload.key, payload.modifiers);
    });

    websocketClient.onRemoteScroll((payload) => {
      logger.info('Remote scroll requested');
      displayController.remoteScroll(payload.x, payload.y, payload.deltaX, payload.deltaY);
    });
  }

  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    signals.forEach((signal) => {
      process.on(signal, () => {
        logger.info(`\nReceived ${signal}, shutting down gracefully...`);
        this.shutdown();
      });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error.message);
      logger.error(error.stack || '');
      websocketClient.sendErrorReport(
        'Uncaught exception',
        error.stack,
        { message: error.message }
      );
    });

    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled rejection:', reason);
      websocketClient.sendErrorReport(
        'Unhandled rejection',
        reason?.stack,
        { reason: String(reason) }
      );
    });
  }

  private async restart(): Promise<void> {
    try {
      logger.warn('Restarting kiosk client...');

      // Stop all services
      playlistExecutor.stop();
      screenshotManager.stop();
      healthMonitor.stop();

      // Restart display
      await displayController.restart();

      // Restart services
      healthMonitor.start();
      screenshotManager.start();

      // Restart playlist executor if it has a playlist
      if (playlistExecutor.hasPlaylist()) {
        playlistExecutor.start();
      }

      logger.info('✅ Kiosk client restarted successfully');
    } catch (error: any) {
      logger.error('Failed to restart:', error.message);
      websocketClient.sendErrorReport('Restart failed', error.stack);
    }
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    logger.info('Shutting down kiosk client...');

    // Send offline status
    websocketClient.sendDeviceStatus(DeviceStatusValues.OFFLINE, 'Client shutting down');

    // Stop all services
    playlistExecutor.stop();
    screenshotManager.stop();
    healthMonitor.stop();

    // Disconnect WebSocket
    websocketClient.disconnect();

    // Shutdown display
    await displayController.shutdown();

    logger.info('✅ Kiosk client shut down successfully');
    process.exit(0);
  }
}

// Start the client
const client = new KioskClient();
client.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
