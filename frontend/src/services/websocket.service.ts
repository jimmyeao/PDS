import type {
  AdminDeviceConnectedPayload,
  AdminDeviceDisconnectedPayload,
  AdminDeviceStatusPayload,
  AdminDeviceHealthPayload,
  AdminScreenshotReceivedPayload,
  AdminErrorPayload,
  PlaybackStateUpdatePayload,
} from '@theiacast/shared';

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
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Callback registries
  private devicesSyncCallbacks: Array<(payload: { deviceIds: string[]; timestamp: Date }) => void> = [];
  private deviceConnectedCallbacks: Array<(payload: AdminDeviceConnectedPayload) => void> = [];
  private deviceDisconnectedCallbacks: Array<(payload: AdminDeviceDisconnectedPayload) => void> = [];
  private deviceStatusCallbacks: Array<(payload: AdminDeviceStatusPayload) => void> = [];
  private deviceHealthCallbacks: Array<(payload: AdminDeviceHealthPayload) => void> = [];
  private screenshotReceivedCallbacks: Array<(payload: AdminScreenshotReceivedPayload) => void> = [];
  private errorCallbacks: Array<(payload: AdminErrorPayload) => void> = [];
  private screencastFrameCallbacks: Array<(payload: any) => void> = [];
  private playbackStateCallbacks: Array<(payload: { deviceId: string; state: PlaybackStateUpdatePayload; timestamp: Date }) => void> = [];

  connect(_token: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    let baseUrl = (import.meta as any).env?.VITE_API_URL || '/api';
    
    // If baseUrl is relative, prepend origin
    if (baseUrl.startsWith('/')) {
      baseUrl = window.location.origin + baseUrl;
    }

    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws?role=admin';

    this.socket = new WebSocket(wsUrl);
    this.setupHandlers();
    return this.socket;
  }

  private setupHandlers() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('✅ WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.socket.onclose = (ev) => {
      console.log('❌ WebSocket disconnected:', ev.reason || ev.code);
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(''), this.reconnectDelay);
      }
    };

    this.socket.onerror = (err) => {
      console.error('WebSocket connection error:', err);
    };

    this.socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        const evt: string = msg.event;
        const payload = msg.payload;

        switch (evt) {
          case 'admin:devices:sync':
            this.devicesSyncCallbacks.forEach((cb) => cb(payload));
            break;
          case ServerToAdminEventValues.DEVICE_CONNECTED:
            this.deviceConnectedCallbacks.forEach((cb) => cb(payload));
            break;
          case ServerToAdminEventValues.DEVICE_DISCONNECTED:
            this.deviceDisconnectedCallbacks.forEach((cb) => cb(payload));
            break;
          case ServerToAdminEventValues.DEVICE_STATUS_CHANGED:
            this.deviceStatusCallbacks.forEach((cb) => cb(payload));
            break;
          case ServerToAdminEventValues.DEVICE_HEALTH_UPDATE:
            this.deviceHealthCallbacks.forEach((cb) => cb(payload));
            break;
          case ServerToAdminEventValues.SCREENSHOT_RECEIVED:
            this.screenshotReceivedCallbacks.forEach((cb) => cb(payload));
            break;
          case ServerToAdminEventValues.ERROR_OCCURRED:
            this.errorCallbacks.forEach((cb) => cb(payload));
            break;
          case 'admin:screencast:frame':
            this.screencastFrameCallbacks.forEach((cb) => cb(payload));
            break;
          case 'admin:playback:state':
            this.playbackStateCallbacks.forEach((cb) => cb(payload));
            break;
        }
      } catch (e) {
        console.error('Failed to parse WS admin message', e);
      }
    };
  }

  disconnect() {
    if (this.socket) {
      try { this.socket.close(); } catch {}
      this.socket = null;
      console.log('WebSocket manually disconnected');
    }
  }

  isConnected(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  // Event listeners for admin events
  onDevicesSync(callback: (payload: { deviceIds: string[]; timestamp: Date }) => void) {
    this.devicesSyncCallbacks.push(callback);
  }

  onDeviceConnected(callback: (payload: AdminDeviceConnectedPayload) => void) {
    this.deviceConnectedCallbacks.push(callback);
  }

  onDeviceDisconnected(callback: (payload: AdminDeviceDisconnectedPayload) => void) {
    this.deviceDisconnectedCallbacks.push(callback);
  }

  onDeviceStatusChanged(callback: (payload: AdminDeviceStatusPayload) => void) {
    this.deviceStatusCallbacks.push(callback);
  }

  onDeviceHealthUpdate(callback: (payload: AdminDeviceHealthPayload) => void) {
    this.deviceHealthCallbacks.push(callback);
  }

  onScreenshotReceived(callback: (payload: AdminScreenshotReceivedPayload) => void) {
    this.screenshotReceivedCallbacks.push(callback);
  }

  onError(callback: (payload: AdminErrorPayload) => void) {
    this.errorCallbacks.push(callback);
  }

  // Remove event listeners
  offDevicesSync(callback: (payload: { deviceIds: string[]; timestamp: Date }) => void) {
    this.devicesSyncCallbacks = this.devicesSyncCallbacks.filter((cb) => cb !== callback);
  }

  offDeviceConnected(callback: (payload: AdminDeviceConnectedPayload) => void) {
    this.deviceConnectedCallbacks = this.deviceConnectedCallbacks.filter((cb) => cb !== callback);
  }

  offDeviceDisconnected(callback: (payload: AdminDeviceDisconnectedPayload) => void) {
    this.deviceDisconnectedCallbacks = this.deviceDisconnectedCallbacks.filter((cb) => cb !== callback);
  }

  offDeviceStatusChanged(callback: (payload: AdminDeviceStatusPayload) => void) {
    this.deviceStatusCallbacks = this.deviceStatusCallbacks.filter((cb) => cb !== callback);
  }

  offDeviceHealthUpdate(callback: (payload: AdminDeviceHealthPayload) => void) {
    this.deviceHealthCallbacks = this.deviceHealthCallbacks.filter((cb) => cb !== callback);
  }

  offScreenshotReceived(callback: (payload: AdminScreenshotReceivedPayload) => void) {
    this.screenshotReceivedCallbacks = this.screenshotReceivedCallbacks.filter((cb) => cb !== callback);
  }

  offError(callback: (payload: AdminErrorPayload) => void) {
    this.errorCallbacks = this.errorCallbacks.filter((cb) => cb !== callback);
  }

  onScreencastFrame(callback: (payload: any) => void) {
    this.screencastFrameCallbacks.push(callback);
  }

  offScreencastFrame(callback: (payload: any) => void) {
    this.screencastFrameCallbacks = this.screencastFrameCallbacks.filter((cb) => cb !== callback);
  }

  onPlaybackStateChanged(callback: (payload: { deviceId: string; state: PlaybackStateUpdatePayload; timestamp: Date }) => void) {
    this.playbackStateCallbacks.push(callback);
  }

  offPlaybackStateChanged(callback: (payload: { deviceId: string; state: PlaybackStateUpdatePayload; timestamp: Date }) => void) {
    this.playbackStateCallbacks = this.playbackStateCallbacks.filter((cb) => cb !== callback);
  }

  // Remove all listeners
  removeAllListeners() {
    this.devicesSyncCallbacks = [];
    this.deviceConnectedCallbacks = [];
    this.deviceDisconnectedCallbacks = [];
    this.deviceStatusCallbacks = [];
    this.deviceHealthCallbacks = [];
    this.screenshotReceivedCallbacks = [];
    this.errorCallbacks = [];
    this.screencastFrameCallbacks = [];
    this.playbackStateCallbacks = [];
  }
}

export const websocketService = new WebSocketService();
