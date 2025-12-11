import api from './api';
import type { Device, CreateDeviceDto, UpdateDeviceDto } from '@kiosk/shared';

export const deviceService = {
  async getAll(): Promise<Device[]> {
    const response = await api.get<Device[]>('/devices');
    return response.data;
  },

  async getById(id: number): Promise<Device> {
    const response = await api.get<Device>(`/devices/${id}`);
    return response.data;
  },

  async create(data: CreateDeviceDto): Promise<Device> {
    const response = await api.post<Device>('/devices', data);
    return response.data;
  },

  async update(id: number, data: UpdateDeviceDto): Promise<Device> {
    const response = await api.patch<Device>(`/devices/${id}`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/devices/${id}`);
  },

  async getLogs(id: number, limit?: number): Promise<any[]> {
    const response = await api.get(`/devices/${id}/logs`, {
      params: { limit },
    });
    return response.data;
  },
};
