import { io, Socket } from 'socket.io-client';
import type {
  AdminDeviceConnectedPayload,
  AdminDeviceDisconnectedPayload,
  AdminDeviceStatusPayload,
  AdminDeviceHealthPayload,
  AdminScreenshotReceivedPayload,
  AdminErrorPayload,
} from '@kiosk/shared';

// Import enum values as constants
const ServerToAdminEventValues = {
  DEVICE_CONNECTED: 'admin:device:connected',
  DEVICE_DISCONNECTED: 'admin:device:disconnected',
  DEVICE_STATUS_CHANGED: 'admin:device:status',
  DEVICE_HEALTH_UPDATE: 'admin:device:health',
  SCREENSHOT_RECEIVED: 'admin:screenshot:received',
  ERROR_OCCURRED: 'admin:error',
} as const;

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(token: string) {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

    this.socket = io(wsUrl, {
      auth: {
        token,
        role: 'admin',
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('WebSocket manually disconnected');
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Event listeners for admin events
  onDevicesSync(callback: (payload: { deviceIds: string[]; timestamp: Date }) => void) {
    this.socket?.on('admin:devices:sync', callback);
  }

  onDeviceConnected(callback: (payload: AdminDeviceConnectedPayload) => void) {
    this.socket?.on(ServerToAdminEventValues.DEVICE_CONNECTED, callback);
  }

  onDeviceDisconnected(callback: (payload: AdminDeviceDisconnectedPayload) => void) {
    this.socket?.on(ServerToAdminEventValues.DEVICE_DISCONNECTED, callback);
  }

  onDeviceStatusChanged(callback: (payload: AdminDeviceStatusPayload) => void) {
    this.socket?.on(ServerToAdminEventValues.DEVICE_STATUS_CHANGED, callback);
  }

  onDeviceHealthUpdate(callback: (payload: AdminDeviceHealthPayload) => void) {
    this.socket?.on(ServerToAdminEventValues.DEVICE_HEALTH_UPDATE, callback);
  }

  onScreenshotReceived(callback: (payload: AdminScreenshotReceivedPayload) => void) {
    this.socket?.on(ServerToAdminEventValues.SCREENSHOT_RECEIVED, callback);
  }

  onError(callback: (payload: AdminErrorPayload) => void) {
    this.socket?.on(ServerToAdminEventValues.ERROR_OCCURRED, callback);
  }

  // Remove event listeners
  offDevicesSync(callback: (payload: { deviceIds: string[]; timestamp: Date }) => void) {
    this.socket?.off('admin:devices:sync', callback);
  }

  offDeviceConnected(callback: (payload: AdminDeviceConnectedPayload) => void) {
    this.socket?.off(ServerToAdminEventValues.DEVICE_CONNECTED, callback);
  }

  offDeviceDisconnected(callback: (payload: AdminDeviceDisconnectedPayload) => void) {
    this.socket?.off(ServerToAdminEventValues.DEVICE_DISCONNECTED, callback);
  }

  offDeviceStatusChanged(callback: (payload: AdminDeviceStatusPayload) => void) {
    this.socket?.off(ServerToAdminEventValues.DEVICE_STATUS_CHANGED, callback);
  }

  offDeviceHealthUpdate(callback: (payload: AdminDeviceHealthPayload) => void) {
    this.socket?.off(ServerToAdminEventValues.DEVICE_HEALTH_UPDATE, callback);
  }

  offScreenshotReceived(callback: (payload: AdminScreenshotReceivedPayload) => void) {
    this.socket?.off(ServerToAdminEventValues.SCREENSHOT_RECEIVED, callback);
  }

  offError(callback: (payload: AdminErrorPayload) => void) {
    this.socket?.off(ServerToAdminEventValues.ERROR_OCCURRED, callback);
  }

  // Remove all listeners
  removeAllListeners() {
    this.socket?.removeAllListeners();
  }
}

export const websocketService = new WebSocketService();
