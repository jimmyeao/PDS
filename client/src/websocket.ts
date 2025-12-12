import { io, Socket } from 'socket.io-client';
import { config } from './config';
import { logger } from './logger';
import type {
  ContentUpdatePayload,
  DisplayNavigatePayload,
  ScreenshotRequestPayload,
  ConfigUpdatePayload,
  DeviceRestartPayload,
  DisplayRefreshPayload,
  DeviceRegisterPayload,
  HealthReportPayload,
  DeviceStatusPayload,
  ErrorReportPayload,
  ScreenshotUploadPayload,
  DeviceInfo,
  DeviceStatus,
} from '@kiosk/shared';

// Event and enum values (since we can't import enums from CommonJS shared package)
const ServerToClientEventValues = {
  CONTENT_UPDATE: 'content:update',
  DISPLAY_NAVIGATE: 'display:navigate',
  SCREENSHOT_REQUEST: 'screenshot:request',
  CONFIG_UPDATE: 'config:update',
  DEVICE_RESTART: 'device:restart',
  DISPLAY_REFRESH: 'display:refresh',
} as const;

const ClientToServerEventValues = {
  DEVICE_REGISTER: 'device:register',
  SCREENSHOT_UPLOAD: 'screenshot:upload',
  HEALTH_REPORT: 'health:report',
  DEVICE_STATUS: 'device:status',
  ERROR_REPORT: 'error:report',
} as const;

export const DeviceStatusValues = {
  ONLINE: 'online' as DeviceStatus,
  OFFLINE: 'offline' as DeviceStatus,
  ERROR: 'error' as DeviceStatus,
} as const;

export type ContentUpdateCallback = (payload: ContentUpdatePayload) => void;
export type DisplayNavigateCallback = (payload: DisplayNavigatePayload) => void;
export type ScreenshotRequestCallback = (payload: ScreenshotRequestPayload) => void;
export type ConfigUpdateCallback = (payload: ConfigUpdatePayload) => void;
export type DeviceRestartCallback = (payload: DeviceRestartPayload) => void;
export type DisplayRefreshCallback = (payload: DisplayRefreshPayload) => void;

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnected = false;

  // Event callbacks
  private contentUpdateCallback?: ContentUpdateCallback;
  private displayNavigateCallback?: DisplayNavigateCallback;
  private screenshotRequestCallback?: ScreenshotRequestCallback;
  private configUpdateCallback?: ConfigUpdateCallback;
  private deviceRestartCallback?: DeviceRestartCallback;
  private displayRefreshCallback?: DisplayRefreshCallback;

  constructor() {}

  public connect(): void {
    if (this.socket?.connected) {
      logger.warn('WebSocket already connected');
      return;
    }

    logger.info(`Connecting to server: ${config.serverUrl}`);

    this.socket = io(config.serverUrl, {
      auth: {
        token: config.deviceToken,
        role: 'device',
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      logger.info(`✅ Connected to server (Socket ID: ${this.socket?.id})`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.registerDevice();
    });

    this.socket.on('disconnect', (reason) => {
      logger.warn(`❌ Disconnected from server: ${reason}`);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      logger.error(`Connection error: ${error.message}`);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error('Max reconnection attempts reached. Stopping...');
        this.disconnect();
      }
    });

    // Server command events
    this.socket.on(ServerToClientEventValues.CONTENT_UPDATE, (payload: ContentUpdatePayload) => {
      logger.info('Received content update', payload);
      this.contentUpdateCallback?.(payload);
    });

    this.socket.on(ServerToClientEventValues.DISPLAY_NAVIGATE, (payload: DisplayNavigatePayload) => {
      logger.info('Received display navigate command', payload);
      this.displayNavigateCallback?.(payload);
    });

    this.socket.on(ServerToClientEventValues.SCREENSHOT_REQUEST, (payload: ScreenshotRequestPayload) => {
      logger.info('Received screenshot request', payload);
      this.screenshotRequestCallback?.(payload);
    });

    this.socket.on(ServerToClientEventValues.CONFIG_UPDATE, (payload: ConfigUpdatePayload) => {
      logger.info('Received config update', payload);
      this.configUpdateCallback?.(payload);
    });

    this.socket.on(ServerToClientEventValues.DEVICE_RESTART, (payload: DeviceRestartPayload) => {
      logger.warn('Received device restart command', payload);
      this.deviceRestartCallback?.(payload);
    });

    this.socket.on(ServerToClientEventValues.DISPLAY_REFRESH, (payload: DisplayRefreshPayload) => {
      logger.info('Received display refresh command', payload);
      this.displayRefreshCallback?.(payload);
    });
  }

  private registerDevice(): void {
    const deviceInfo: DeviceInfo = {
      deviceId: 'unknown', // Will be set by backend from token
      name: 'Client Device', // Will be overridden by backend
      ipAddress: '0.0.0.0', // Will be detected by backend
      screenResolution: `${config.displayWidth}x${config.displayHeight}`,
      osVersion: `${process.platform} ${process.arch}`,
      clientVersion: '1.0.0',
    };

    const payload: DeviceRegisterPayload = {
      deviceInfo,
    };

    this.socket?.emit(ClientToServerEventValues.DEVICE_REGISTER, payload);
    logger.debug('Device registration sent');
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      logger.info('WebSocket disconnected');
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Event emitters to server
  public sendHealthReport(health: HealthReportPayload): void {
    if (!this.isConnected) {
      logger.warn('Cannot send health report: not connected');
      return;
    }
    this.socket?.emit(ClientToServerEventValues.HEALTH_REPORT, health);
    logger.debug('Health report sent', health);
  }

  public sendDeviceStatus(status: DeviceStatus, message?: string): void {
    if (!this.isConnected && status !== DeviceStatusValues.OFFLINE) {
      logger.warn('Cannot send device status: not connected');
      return;
    }

    const payload: DeviceStatusPayload = {
      status,
      message,
    };

    this.socket?.emit(ClientToServerEventValues.DEVICE_STATUS, payload);
    logger.debug('Device status sent', payload);
  }

  public sendErrorReport(error: string, stack?: string, context?: any): void {
    if (!this.isConnected) {
      logger.warn('Cannot send error report: not connected');
      return;
    }

    const payload: ErrorReportPayload = {
      error,
      stack,
      context,
    };

    this.socket?.emit(ClientToServerEventValues.ERROR_REPORT, payload);
    logger.error('Error report sent', payload);
  }

  public sendScreenshot(image: string, currentUrl: string): void {
    if (!this.isConnected) {
      logger.warn('Cannot send screenshot: not connected');
      return;
    }

    const payload: ScreenshotUploadPayload = {
      image,
      timestamp: Date.now(),
      currentUrl,
    };

    this.socket?.emit(ClientToServerEventValues.SCREENSHOT_UPLOAD, payload);
    logger.debug('Screenshot sent');
  }

  // Event callback setters
  public onContentUpdate(callback: ContentUpdateCallback): void {
    this.contentUpdateCallback = callback;
  }

  public onDisplayNavigate(callback: DisplayNavigateCallback): void {
    this.displayNavigateCallback = callback;
  }

  public onScreenshotRequest(callback: ScreenshotRequestCallback): void {
    this.screenshotRequestCallback = callback;
  }

  public onConfigUpdate(callback: ConfigUpdateCallback): void {
    this.configUpdateCallback = callback;
  }

  public onDeviceRestart(callback: DeviceRestartCallback): void {
    this.deviceRestartCallback = callback;
  }

  public onDisplayRefresh(callback: DisplayRefreshCallback): void {
    this.displayRefreshCallback = callback;
  }
}

export const websocketClient = new WebSocketClient();
