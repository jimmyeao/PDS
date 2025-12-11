import api from './api';
import type { Screenshot } from '@kiosk/shared';

export const screenshotService = {
  /**
   * Get the latest screenshot for a device
   */
  async getLatestByDevice(deviceId: string): Promise<Screenshot | null> {
    const response = await api.get<Screenshot | null>(
      `/screenshots/device/${deviceId}/latest`
    );
    return response.data;
  },

  /**
   * Get all screenshots for a device (limited to last 10)
   */
  async getDeviceScreenshots(deviceId: string, limit: number = 10): Promise<Screenshot[]> {
    const response = await api.get<Screenshot[]>(
      `/screenshots/device/${deviceId}`,
      { params: { limit } }
    );
    return response.data;
  },

  /**
   * Get a specific screenshot by ID
   */
  async getScreenshotById(id: number): Promise<Screenshot> {
    const response = await api.get<Screenshot>(`/screenshots/${id}`);
    return response.data;
  },
};
