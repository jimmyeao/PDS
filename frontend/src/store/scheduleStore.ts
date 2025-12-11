import { create } from 'zustand';
import type { Schedule, ScheduleItem, CreateScheduleDto, UpdateScheduleDto, CreateScheduleItemDto, UpdateScheduleItemDto } from '@kiosk/shared';
import { scheduleService } from '../services/schedule.service';

interface ScheduleState {
  schedules: Schedule[];
  selectedSchedule: Schedule | null;
  scheduleItems: ScheduleItem[];
  isLoading: boolean;
  error: string | null;

  fetchSchedules: () => Promise<void>;
  fetchScheduleById: (id: number) => Promise<void>;
  createSchedule: (data: CreateScheduleDto) => Promise<Schedule>;
  updateSchedule: (id: number, data: UpdateScheduleDto) => Promise<void>;
  deleteSchedule: (id: number) => Promise<void>;

  fetchScheduleItems: (scheduleId: number) => Promise<void>;
  createScheduleItem: (data: CreateScheduleItemDto) => Promise<void>;
  updateScheduleItem: (id: number, data: UpdateScheduleItemDto) => Promise<void>;
  deleteScheduleItem: (id: number) => Promise<void>;

  assignScheduleToDevice: (deviceId: number, scheduleId: number) => Promise<void>;
  unassignScheduleFromDevice: (deviceId: number, scheduleId: number) => Promise<void>;

  setSelectedSchedule: (schedule: Schedule | null) => void;
  clearError: () => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  schedules: [],
  selectedSchedule: null,
  scheduleItems: [],
  isLoading: false,
  error: null,

  fetchSchedules: async () => {
    set({ isLoading: true, error: null });
    try {
      const schedules = await scheduleService.getAll();
      set({ schedules, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch schedules',
        isLoading: false,
      });
    }
  },

  fetchScheduleById: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const schedule = await scheduleService.getById(id);
      set({ selectedSchedule: schedule, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch schedule',
        isLoading: false,
      });
    }
  },

  createSchedule: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const schedule = await scheduleService.create(data);
      set({ isLoading: false });
      return schedule;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create schedule',
        isLoading: false,
      });
      throw error;
    }
  },

  updateSchedule: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await scheduleService.update(id, data);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update schedule',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteSchedule: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await scheduleService.delete(id);
      set((state) => ({
        schedules: state.schedules.filter((s) => s.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to delete schedule',
        isLoading: false,
      });
      throw error;
    }
  },

  fetchScheduleItems: async (scheduleId: number) => {
    set({ isLoading: true, error: null });
    try {
      const items = await scheduleService.getScheduleItems(scheduleId);
      set({ scheduleItems: items, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch schedule items',
        isLoading: false,
      });
    }
  },

  createScheduleItem: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await scheduleService.createItem(data);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create schedule item',
        isLoading: false,
      });
      throw error;
    }
  },

  updateScheduleItem: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await scheduleService.updateItem(id, data);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update schedule item',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteScheduleItem: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await scheduleService.deleteItem(id);
      set((state) => ({
        scheduleItems: state.scheduleItems.filter((item) => item.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to delete schedule item',
        isLoading: false,
      });
      throw error;
    }
  },

  assignScheduleToDevice: async (deviceId, scheduleId) => {
    set({ isLoading: true, error: null });
    try {
      await scheduleService.assignToDevice(deviceId, scheduleId);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to assign schedule',
        isLoading: false,
      });
      throw error;
    }
  },

  unassignScheduleFromDevice: async (deviceId, scheduleId) => {
    set({ isLoading: true, error: null });
    try {
      await scheduleService.unassignFromDevice(deviceId, scheduleId);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to unassign schedule',
        isLoading: false,
      });
      throw error;
    }
  },

  setSelectedSchedule: (schedule) => set({ selectedSchedule: schedule }),
  clearError: () => set({ error: null }),
}));
