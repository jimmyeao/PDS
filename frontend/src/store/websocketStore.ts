import { create } from 'zustand';
import { websocketService } from '../services/websocket.service';
import type {
  AdminDeviceConnectedPayload,
  AdminDeviceDisconnectedPayload,
  AdminDeviceStatusPayload,
  AdminErrorPayload,
  PlaybackStateUpdatePayload,
} from '@kiosk/shared';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
}

interface WebSocketState {
  isConnected: boolean;
  connectedDevices: Set<string>;
  notifications: Notification[];
  deviceStatus: Map<string, string>;
  deviceErrors: Map<string, string>;
  navigationErrorNotified: Map<string, boolean>;
  devicePlaybackState: Map<string, PlaybackStateUpdatePayload>;

  connect: (token: string) => void;
  disconnect: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  isConnected: false,
  connectedDevices: new Set(),
  notifications: [],
  deviceStatus: new Map(),
  deviceErrors: new Map(),
  navigationErrorNotified: new Map(),
  devicePlaybackState: new Map(),

  connect: (token: string) => {
    websocketService.connect(token);

    // Initial sync of connected devices
    websocketService.onDevicesSync((payload) => {
      console.log('Received devices sync:', payload.deviceIds);

      set({
        connectedDevices: new Set(payload.deviceIds),
      });
    });

    // Device connected event
    websocketService.onDeviceConnected((payload: AdminDeviceConnectedPayload) => {
      console.log('Device connected:', payload.deviceId);

      set((state) => {
        const newDevices = new Set(state.connectedDevices);
        newDevices.add(payload.deviceId);
        const newStatus = new Map(state.deviceStatus);
        newStatus.set(payload.deviceId, 'online');
        return { connectedDevices: newDevices, deviceStatus: newStatus };
      });
    });

    // Device disconnected event
    websocketService.onDeviceDisconnected((payload: AdminDeviceDisconnectedPayload) => {
      console.log('Device disconnected:', payload.deviceId);

      set((state) => {
        const newDevices = new Set(state.connectedDevices);
        newDevices.delete(payload.deviceId);
        const newStatus = new Map(state.deviceStatus);
        newStatus.set(payload.deviceId, 'offline');
        return { connectedDevices: newDevices, deviceStatus: newStatus };
      });
    });

    // Device status changed event
    websocketService.onDeviceStatusChanged((payload: AdminDeviceStatusPayload) => {
      console.log('Device status changed:', payload.deviceId, payload.status);

      set((state) => {
        const newStatus = new Map(state.deviceStatus);
        newStatus.set(payload.deviceId, payload.status);
        return { deviceStatus: newStatus };
      });
    });

    // Error event
    websocketService.onError((payload: AdminErrorPayload) => {
      console.error('Device error:', payload.deviceId, payload.error);

      // Filter out screenshot and remote type errors (noise - we have live streaming now)
      const isNoiseError =
        payload.error?.toLowerCase().includes('screenshot') ||
        payload.error?.toLowerCase().includes('remote type failed') ||
        payload.error?.toLowerCase().includes('no text input focused');

      const isNavigationError = payload.error?.toLowerCase().includes('navigate');

      if (!isNoiseError) {
        // Track latest error per device
        set((state) => {
          const newErrors = new Map(state.deviceErrors);
          newErrors.set(payload.deviceId, payload.error || 'Unknown error');
          return { deviceErrors: newErrors };
        });

        // Only toast navigation failed once per device per session
        if (isNavigationError) {
          const notified = get().navigationErrorNotified.get(payload.deviceId);
          if (!notified) {
            get().addNotification({
              type: 'error',
              title: `Navigation failed (${payload.deviceId})`,
              message: payload.error,
            });
            set((state) => {
              const map = new Map(state.navigationErrorNotified);
              map.set(payload.deviceId, true);
              return { navigationErrorNotified: map };
            });
          }
        } else {
          // Non-navigation errors: still toast, but avoid spam by deduping identical consecutive messages
          const lastError = get().deviceErrors.get(payload.deviceId);
          if (lastError !== payload.error) {
            get().addNotification({
              type: 'error',
              title: `Error on ${payload.deviceId}`,
              message: payload.error,
            });
          }
        }
      }
    });

    // Playback state changed event
    websocketService.onPlaybackStateChanged((payload) => {
      console.log('Playback state changed:', payload.deviceId, payload.state);

      set((state) => {
        const newPlaybackState = new Map(state.devicePlaybackState);
        newPlaybackState.set(payload.deviceId, payload.state);
        return { devicePlaybackState: newPlaybackState };
      });
    });

    set({ isConnected: true });
  },

  disconnect: () => {
    websocketService.removeAllListeners();
    websocketService.disconnect();
    set({
      isConnected: false,
      connectedDevices: new Set(),
      deviceStatus: new Map(),
      deviceErrors: new Map(),
      navigationErrorNotified: new Map(),
      devicePlaybackState: new Map(),
    });
  },

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
    }));

    // Auto-remove after 5 seconds
    setTimeout(() => {
      get().removeNotification(newNotification.id);
    }, 5000);
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },
}));
