import { DeviceInfo, DeviceHealthMetrics, DeviceStatus } from './device.types';
import { PlaylistItem } from './playlist.types';

// WebSocket Events - Backend to Client (Devices)
export enum ServerToClientEvent {
  CONTENT_UPDATE = 'content:update',
  DISPLAY_NAVIGATE = 'display:navigate',
  SCREENSHOT_REQUEST = 'screenshot:request',
  CONFIG_UPDATE = 'config:update',
  DEVICE_RESTART = 'device:restart',
  DISPLAY_REFRESH = 'display:refresh',
}

// WebSocket Events - Backend to Admin UI
export enum ServerToAdminEvent {
  DEVICE_CONNECTED = 'admin:device:connected',
  DEVICE_DISCONNECTED = 'admin:device:disconnected',
  DEVICE_STATUS_CHANGED = 'admin:device:status',
  DEVICE_HEALTH_UPDATE = 'admin:device:health',
  SCREENSHOT_RECEIVED = 'admin:screenshot:received',
  ERROR_OCCURRED = 'admin:error',
}

// WebSocket Events - Client to Backend
export enum ClientToServerEvent {
  DEVICE_REGISTER = 'device:register',
  SCREENSHOT_UPLOAD = 'screenshot:upload',
  HEALTH_REPORT = 'health:report',
  DEVICE_STATUS = 'device:status',
  ERROR_REPORT = 'error:report',
}

// Payload types for Backend → Client
export interface ContentUpdatePayload {
  playlistId: number;
  items: PlaylistItem[];
}

export interface DisplayNavigatePayload {
  url: string;
  duration?: number;
}

export interface ScreenshotRequestPayload {
  timestamp: number;
}

export interface ConfigUpdatePayload {
  screenshotInterval?: number;
  healthCheckInterval?: number;
  [key: string]: any;
}

export interface DeviceRestartPayload {
  message?: string;
}

export interface DisplayRefreshPayload {
  force?: boolean;
}

// Payload types for Client → Backend
// Note: deviceId is no longer included in these payloads - it's determined from the authenticated WebSocket connection
export interface DeviceRegisterPayload {
  deviceInfo: DeviceInfo;
}

export interface ScreenshotUploadPayload {
  image: string; // Base64 encoded
  timestamp: number;
  currentUrl: string;
}

export interface HealthReportPayload extends DeviceHealthMetrics {}

export interface DeviceStatusPayload {
  status: DeviceStatus;
  message?: string;
}

export interface ErrorReportPayload {
  error: string;
  stack?: string;
  context?: any;
}

// Admin UI event payloads
export interface AdminDeviceConnectedPayload {
  deviceId: string;
  timestamp: Date;
}

export interface AdminDeviceDisconnectedPayload {
  deviceId: string;
  timestamp: Date;
}

export interface AdminDeviceStatusPayload {
  deviceId: string;
  status: DeviceStatus;
  timestamp: Date;
}

export interface AdminDeviceHealthPayload {
  deviceId: string;
  health: DeviceHealthMetrics;
  timestamp: Date;
}

export interface AdminScreenshotReceivedPayload {
  deviceId: string;
  screenshotId: number;
  timestamp: Date;
}

export interface AdminErrorPayload {
  deviceId: string;
  error: string;
  timestamp: Date;
}

// WebSocket Authentication
export interface WebSocketAuthPayload {
  token?: string;
  role?: 'device' | 'admin';
}
