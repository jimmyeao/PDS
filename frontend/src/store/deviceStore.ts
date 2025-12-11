import { create } from 'zustand';
import type { Device } from '@kiosk/shared';
import { deviceService } from '../services/device.service';

interface DeviceState {
  devices: Device[];
  selectedDevice: Device | null;
  isLoading: boolean;
  error: string | null;

  fetchDevices: () => Promise<void>;
  fetchDevice: (id: number) => Promise<void>;
  createDevice: (data: any) => Promise<void>;
  updateDevice: (id: number, data: any) => Promise<void>;
  deleteDevice: (id: number) => Promise<void>;
  setSelectedDevice: (device: Device | null) => void;
  clearError: () => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  selectedDevice: null,
  isLoading: false,
  error: null,

  fetchDevices: async () => {
    set({ isLoading: true, error: null });
    try {
      const devices = await deviceService.getAll();
      set({ devices, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch devices',
        isLoading: false,
      });
    }
  },

  fetchDevice: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const device = await deviceService.getById(id);
      set({ selectedDevice: device, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch device',
        isLoading: false,
      });
    }
  },

  createDevice: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await deviceService.create(data);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create device',
        isLoading: false,
      });
      throw error;
    }
  },

  updateDevice: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await deviceService.update(id, data);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update device',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteDevice: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deviceService.delete(id);
      set((state) => ({
        devices: state.devices.filter((d) => d.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to delete device',
        isLoading: false,
      });
      throw error;
    }
  },

  setSelectedDevice: (device) => set({ selectedDevice: device }),
  clearError: () => set({ error: null }),
}));
