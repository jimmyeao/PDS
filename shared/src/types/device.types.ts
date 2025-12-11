export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error',
}

export interface Device {
  id: number;
  deviceId: string;
  name: string;
  description?: string;
  ipAddress?: string;
  location?: string;
  status: DeviceStatus;
  lastSeen?: Date;
  screenResolution?: string;
  osVersion?: string;
  clientVersion?: string;
  registeredAt: Date;
  updatedAt: Date;
}

export interface DeviceInfo {
  deviceId: string;
  name: string;
  ipAddress: string;
  screenResolution: string;
  osVersion: string;
  clientVersion: string;
}

export interface DeviceHealthMetrics {
  deviceId: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  uptime: number;
  currentUrl: string;
  browserStatus: 'running' | 'crashed';
  timestamp: Date;
}

export interface CreateDeviceDto {
  deviceId: string;
  name: string;
  description?: string;
  location?: string;
}

export interface UpdateDeviceDto {
  name?: string;
  description?: string;
  location?: string;
  status?: DeviceStatus;
}

export interface Screenshot {
  id: number;
  deviceId: number;
  imageData: string;
  url: string;
  capturedAt: Date;
}
