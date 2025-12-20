import { create } from 'zustand';
import type { Playlist, PlaylistItem, CreatePlaylistDto, UpdatePlaylistDto, CreatePlaylistItemDto, UpdatePlaylistItemDto } from '@theiacast/shared';
import { playlistService } from '../services/playlist.service';

interface PlaylistState {
  playlists: Playlist[];
  selectedPlaylist: Playlist | null;
  playlistItems: PlaylistItem[];
  isLoading: boolean;
  error: string | null;

  fetchPlaylists: () => Promise<void>;
  fetchPlaylistById: (id: number) => Promise<void>;
  createPlaylist: (data: CreatePlaylistDto) => Promise<Playlist>;
  updatePlaylist: (id: number, data: UpdatePlaylistDto) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;

  fetchPlaylistItems: (playlistId: number) => Promise<void>;
  createPlaylistItem: (data: CreatePlaylistItemDto) => Promise<void>;
  updatePlaylistItem: (id: number, data: UpdatePlaylistItemDto) => Promise<void>;
  deletePlaylistItem: (id: number) => Promise<void>;

  assignPlaylistToDevice: (deviceId: number, playlistId: number) => Promise<void>;
  unassignPlaylistFromDevice: (deviceId: number, playlistId: number) => Promise<void>;

  setSelectedPlaylist: (playlist: Playlist | null) => void;
  clearError: () => void;
}

export const usePlaylistStore = create<PlaylistState>((set) => ({
  playlists: [],
  selectedPlaylist: null,
  playlistItems: [],
  isLoading: false,
  error: null,

  fetchPlaylists: async () => {
    set({ isLoading: true, error: null });
    try {
      const playlists = await playlistService.getAll();
      // Ensure items are populated by fetching per-playlist if missing
      const withItems = await Promise.all(
        playlists.map(async (p) => {
          if (!p.items || p.items.length === 0) {
            try {
              const items = await playlistService.getPlaylistItems(p.id);
              return { ...p, items };
            } catch {
              return p;
            }
          }
          return p;
        })
      );
      set({ playlists: withItems, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch playlists',
        isLoading: false,
      });
    }
  },

  fetchPlaylistById: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const playlist = await playlistService.getById(id);
      set({ selectedPlaylist: playlist, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch playlist',
        isLoading: false,
      });
    }
  },

  createPlaylist: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const playlist = await playlistService.create(data);
      set({ isLoading: false });
      return playlist;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create playlist',
        isLoading: false,
      });
      throw error;
    }
  },

  updatePlaylist: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await playlistService.update(id, data);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update playlist',
        isLoading: false,
      });
      throw error;
    }
  },

  deletePlaylist: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await playlistService.delete(id);
      set((state) => ({
        playlists: state.playlists.filter((p) => p.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to delete playlist',
        isLoading: false,
      });
      throw error;
    }
  },

  fetchPlaylistItems: async (playlistId: number) => {
    set({ isLoading: true, error: null });
    try {
      const items = await playlistService.getPlaylistItems(playlistId);
      set({ playlistItems: items, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch playlist items',
        isLoading: false,
      });
    }
  },

  createPlaylistItem: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const created = await playlistService.createItem(data);
      // Update local state: append to matching playlist.items and playlistItems
      set((state) => {
        const playlists = state.playlists.map((p) =>
          p.id === created.playlistId
            ? {
                ...p,
                items: [...(p.items || []), created].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
              }
            : p
        );
        const playlistItems = state.selectedPlaylist?.id === created.playlistId
          ? [...state.playlistItems, created]
          : state.playlistItems;
        return { playlists, playlistItems, isLoading: false };
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create playlist item',
        isLoading: false,
      });
      throw error;
    }
  },

  updatePlaylistItem: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await playlistService.updateItem(id, data);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update playlist item',
        isLoading: false,
      });
      throw error;
    }
  },

  deletePlaylistItem: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await playlistService.deleteItem(id);
      set((state) => ({
        playlistItems: state.playlistItems.filter((item) => item.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to delete playlist item',
        isLoading: false,
      });
      throw error;
    }
  },

  assignPlaylistToDevice: async (deviceId, playlistId) => {
    set({ isLoading: true, error: null });
    try {
      await playlistService.assignToDevice(deviceId, playlistId);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to assign playlist',
        isLoading: false,
      });
      throw error;
    }
  },

  unassignPlaylistFromDevice: async (deviceId, playlistId) => {
    set({ isLoading: true, error: null });
    try {
      await playlistService.unassignFromDevice(deviceId, playlistId);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to unassign playlist',
        isLoading: false,
      });
      throw error;
    }
  },

  setSelectedPlaylist: (playlist) => set({ selectedPlaylist: playlist }),
  clearError: () => set({ error: null }),
}));
