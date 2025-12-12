import api from './api';
import type {
  Playlist,
  CreatePlaylistDto,
  UpdatePlaylistDto,
  PlaylistItem,
  CreatePlaylistItemDto,
  UpdatePlaylistItemDto,
  DevicePlaylistAssignment,
} from '@kiosk/shared';

export const playlistService = {
  // Playlist operations
  async getAll(): Promise<Playlist[]> {
    const response = await api.get<Playlist[]>('/playlists');
    return response.data;
  },

  async getById(id: number): Promise<Playlist> {
    const response = await api.get<Playlist>(`/playlists/${id}`);
    return response.data;
  },

  async create(data: CreatePlaylistDto): Promise<Playlist> {
    const response = await api.post<Playlist>('/playlists', data);
    return response.data;
  },

  async update(id: number, data: UpdatePlaylistDto): Promise<Playlist> {
    const response = await api.patch<Playlist>(`/playlists/${id}`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/playlists/${id}`);
  },

  // Playlist item operations
  async createItem(data: CreatePlaylistItemDto): Promise<PlaylistItem> {
    const response = await api.post<PlaylistItem>('/playlists/items', data);
    return response.data;
  },

  async getPlaylistItems(playlistId: number): Promise<PlaylistItem[]> {
    const response = await api.get<PlaylistItem[]>(`/playlists/${playlistId}/items`);
    return response.data;
  },

  async updateItem(id: number, data: UpdatePlaylistItemDto): Promise<PlaylistItem> {
    const response = await api.patch<PlaylistItem>(`/playlists/items/${id}`, data);
    return response.data;
  },

  async deleteItem(id: number): Promise<void> {
    await api.delete(`/playlists/items/${id}`);
  },

  // Device playlist assignment operations
  async assignToDevice(deviceId: number, playlistId: number): Promise<DevicePlaylistAssignment> {
    const response = await api.post<DevicePlaylistAssignment>('/playlists/assign', {
      deviceId,
      playlistId,
    });
    return response.data;
  },

  async getDevicePlaylists(deviceId: number): Promise<Playlist[]> {
    const response = await api.get<Playlist[]>(`/playlists/device/${deviceId}`);
    return response.data;
  },

  async getPlaylistDevices(playlistId: number): Promise<DevicePlaylistAssignment[]> {
    const response = await api.get<DevicePlaylistAssignment[]>(`/playlists/${playlistId}/devices`);
    return response.data;
  },

  async unassignFromDevice(deviceId: number, playlistId: number): Promise<void> {
    await api.delete(`/playlists/assign/device/${deviceId}/playlist/${playlistId}`);
  },
};
