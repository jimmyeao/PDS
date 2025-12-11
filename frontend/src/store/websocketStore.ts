import { create } from 'zustand';
import { websocketService } from '../services/websocket.service';
import type {
  AdminDeviceConnectedPayload,
  AdminDeviceDisconnectedPayload,
  AdminDeviceStatusPayload,
  AdminErrorPayload,
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
        return { connectedDevices: newDevices };
      });

      get().addNotification({
        type: 'success',
        title: 'Device Connected',
        message: `Device ${payload.deviceId} is now online`,
      });
    });

    // Device disconnected event
    websocketService.onDeviceDisconnected((payload: AdminDeviceDisconnectedPayload) => {
      console.log('Device disconnected:', payload.deviceId);

      set((state) => {
        const newDevices = new Set(state.connectedDevices);
        newDevices.delete(payload.deviceId);
        return { connectedDevices: newDevices };
      });

      get().addNotification({
        type: 'warning',
        title: 'Device Disconnected',
        message: `Device ${payload.deviceId} went offline`,
      });
    });

    // Device status changed event
    websocketService.onDeviceStatusChanged((payload: AdminDeviceStatusPayload) => {
      console.log('Device status changed:', payload.deviceId, payload.status);

      get().addNotification({
        type: 'info',
        title: 'Device Status Update',
        message: `Device ${payload.deviceId} is now ${payload.status}`,
      });
    });

    // Error event
    websocketService.onError((payload: AdminErrorPayload) => {
      console.error('Device error:', payload.deviceId, payload.error);

      get().addNotification({
        type: 'error',
        title: `Error on ${payload.deviceId}`,
        message: payload.error,
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
