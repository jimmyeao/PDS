import api from './api';
import type {
  Schedule,
  CreateScheduleDto,
  UpdateScheduleDto,
  ScheduleItem,
  CreateScheduleItemDto,
  UpdateScheduleItemDto,
  DeviceScheduleAssignment,
} from '@kiosk/shared';

export const scheduleService = {
  // Schedule operations
  async getAll(): Promise<Schedule[]> {
    const response = await api.get<Schedule[]>('/schedules');
    return response.data;
  },

  async getById(id: number): Promise<Schedule> {
    const response = await api.get<Schedule>(`/schedules/${id}`);
    return response.data;
  },

  async create(data: CreateScheduleDto): Promise<Schedule> {
    const response = await api.post<Schedule>('/schedules', data);
    return response.data;
  },

  async update(id: number, data: UpdateScheduleDto): Promise<Schedule> {
    const response = await api.patch<Schedule>(`/schedules/${id}`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/schedules/${id}`);
  },

  // Schedule item operations
  async createItem(data: CreateScheduleItemDto): Promise<ScheduleItem> {
    const response = await api.post<ScheduleItem>('/schedules/items', data);
    return response.data;
  },

  async getScheduleItems(scheduleId: number): Promise<ScheduleItem[]> {
    const response = await api.get<ScheduleItem[]>(`/schedules/${scheduleId}/items`);
    return response.data;
  },

  async updateItem(id: number, data: UpdateScheduleItemDto): Promise<ScheduleItem> {
    const response = await api.patch<ScheduleItem>(`/schedules/items/${id}`, data);
    return response.data;
  },

  async deleteItem(id: number): Promise<void> {
    await api.delete(`/schedules/items/${id}`);
  },

  // Device schedule assignment operations
  async assignToDevice(deviceId: number, scheduleId: number): Promise<DeviceScheduleAssignment> {
    const response = await api.post<DeviceScheduleAssignment>('/schedules/assign', {
      deviceId,
      scheduleId,
    });
    return response.data;
  },

  async getDeviceSchedules(deviceId: number): Promise<Schedule[]> {
    const response = await api.get<Schedule[]>(`/schedules/device/${deviceId}`);
    return response.data;
  },

  async getScheduleDevices(scheduleId: number): Promise<DeviceScheduleAssignment[]> {
    const response = await api.get<DeviceScheduleAssignment[]>(`/schedules/${scheduleId}/devices`);
    return response.data;
  },

  async unassignFromDevice(deviceId: number, scheduleId: number): Promise<void> {
    await api.delete(`/schedules/assign/device/${deviceId}/schedule/${scheduleId}`);
  },
};
