import api from './api';
import type { Content, CreateContentDto, UpdateContentDto } from '@kiosk/shared';

export const contentService = {
  async getAll(): Promise<Content[]> {
    const response = await api.get<Content[]>('/content');
    return response.data;
  },

  async getById(id: number): Promise<Content> {
    const response = await api.get<Content>(`/content/${id}`);
    return response.data;
  },

  async create(data: CreateContentDto): Promise<Content> {
    const response = await api.post<Content>('/content', data);
    return response.data;
  },

  async update(id: number, data: UpdateContentDto): Promise<Content> {
    const response = await api.patch<Content>(`/content/${id}`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/content/${id}`);
  },
};
