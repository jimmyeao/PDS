import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, forwardRef, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ClientToServerEvent,
  ServerToClientEvent,
  ServerToAdminEvent,
} from '@kiosk/shared';
import type {
  DeviceRegisterPayload,
  HealthReportPayload,
  DeviceStatusPayload,
  ErrorReportPayload,
  ScreenshotUploadPayload,
  AdminDeviceConnectedPayload,
  AdminDeviceDisconnectedPayload,
  AdminDeviceStatusPayload,
  AdminDeviceHealthPayload,
  AdminErrorPayload,
  AdminScreenshotReceivedPayload,
  ContentUpdatePayload,
} from '@kiosk/shared';
import { ScreenshotsService } from '../screenshots/screenshots.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { DevicesService } from '../devices/devices.service';
import { Device } from '../devices/entities/device.entity';

interface AuthenticatedSocket extends Socket {
  deviceId?: string;
  device?: Device; // Full device entity for device connections
  role?: 'device' | 'admin';
  userId?: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class WebSocketGatewayService
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGatewayService.name);
  private deviceSockets = new Map<string, AuthenticatedSocket>();
  private adminSockets = new Set<AuthenticatedSocket>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(forwardRef(() => DevicesService))
    private devicesService: DevicesService,
    @Inject(forwardRef(() => ScreenshotsService))
    private screenshotsService: ScreenshotsService,
    @Inject(forwardRef(() => PlaylistsService))
    private playlistsService: PlaylistsService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client attempting to connect: ${client.id}`);

    try {
      // Extract token from handshake
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const secret = this.configService.get<string>('jwt.secret') || 'dev-secret-key';
      const payload = await this.jwtService.verifyAsync(token, { secret });

      // Check if this is an admin or device connection
      const role = client.handshake.auth?.role || 'admin';

      if (role === 'admin') {
        client.role = 'admin';
        client.userId = payload.sub;
        this.adminSockets.add(client);
        this.logger.log(`Admin connected: ${client.id} (User ID: ${client.userId})`);

        // Send current list of connected devices to the newly connected admin
        const connectedDeviceIds = Array.from(this.deviceSockets.keys());
        if (connectedDeviceIds.length > 0) {
          client.emit('admin:devices:sync', {
            deviceIds: connectedDeviceIds,
            timestamp: new Date(),
          });
          this.logger.debug(`Sent ${connectedDeviceIds.length} connected devices to admin ${client.id}`);
        }
      } else if (role === 'device') {
        // Get device info from JWT payload
        const deviceDbId = payload.sub; // Database ID
        const deviceId = payload.deviceId; // String ID for display/logging

        if (!deviceDbId || !deviceId) {
          this.logger.warn(`Device connection rejected: Invalid token payload`);
          client.disconnect();
          return;
        }

        // Load full device entity from database
        try {
          const device = await this.devicesService.findOne(deviceDbId);

          client.role = 'device';
          client.deviceId = deviceId; // String ID for Map key
          client.device = device; // Full entity
          this.deviceSockets.set(deviceId, client);
          this.logger.log(`Device connected: ${deviceId} (Socket: ${client.id})`);

          // Notify admins
          this.notifyAdmins(ServerToAdminEvent.DEVICE_CONNECTED, {
            deviceId,
            timestamp: new Date(),
          } as AdminDeviceConnectedPayload);

          // Send device's playlist
          try {
            const playlists = await this.playlistsService.getDevicePlaylists(device.id);
            const activePlaylist = playlists.find(p => p.isActive);

            if (activePlaylist && activePlaylist.items && activePlaylist.items.length > 0) {
              const payload: ContentUpdatePayload = {
                playlistId: activePlaylist.id,
                items: activePlaylist.items,
              };
              client.emit(ServerToClientEvent.CONTENT_UPDATE, payload);
              this.logger.log(`Sent playlist with ${activePlaylist.items.length} items to device ${deviceId}`);
            } else {
              this.logger.debug(`No active playlist found for device ${deviceId}`);
            }
          } catch (error) {
            this.logger.error(`Failed to send playlist to device ${deviceId}: ${error.message}`);
          }
        } catch (error) {
          this.logger.error(`Device lookup failed for ID ${deviceDbId}: ${error.message}`);
          client.disconnect();
          return;
        }
      }
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.role === 'admin') {
      this.adminSockets.delete(client);
      this.logger.log(`Admin disconnected: ${client.id}`);
    } else if (client.role === 'device' && client.deviceId) {
      this.deviceSockets.delete(client.deviceId);
      this.logger.log(`Device disconnected: ${client.deviceId}`);

      // Notify admins
      this.notifyAdmins(ServerToAdminEvent.DEVICE_DISCONNECTED, {
        deviceId: client.deviceId,
        timestamp: new Date(),
      } as AdminDeviceDisconnectedPayload);
    }
  }

  // Device event handlers
  @SubscribeMessage(ClientToServerEvent.DEVICE_REGISTER)
  handleDeviceRegister(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DeviceRegisterPayload,
  ) {
    this.logger.log(`Device registered: ${client.deviceId}`);
    // Device registration logic handled in handleConnection
    return { success: true };
  }

  @SubscribeMessage(ClientToServerEvent.HEALTH_REPORT)
  handleHealthReport(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: HealthReportPayload,
  ) {
    if (!client.deviceId) return;

    this.logger.debug(`Health report from ${client.deviceId}`);

    // Notify admins
    this.notifyAdmins(ServerToAdminEvent.DEVICE_HEALTH_UPDATE, {
      deviceId: client.deviceId,
      health: payload,
      timestamp: new Date(),
    } as AdminDeviceHealthPayload);
  }

  @SubscribeMessage(ClientToServerEvent.DEVICE_STATUS)
  handleDeviceStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DeviceStatusPayload,
  ) {
    if (!client.deviceId) return;

    this.logger.log(`Device status update: ${client.deviceId} - ${payload.status}`);

    // Notify admins
    this.notifyAdmins(ServerToAdminEvent.DEVICE_STATUS_CHANGED, {
      deviceId: client.deviceId,
      status: payload.status,
      timestamp: new Date(),
    } as AdminDeviceStatusPayload);
  }

  @SubscribeMessage(ClientToServerEvent.ERROR_REPORT)
  handleErrorReport(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ErrorReportPayload,
  ) {
    if (!client.device) {
      this.logger.error('Error report from unauthenticated client');
      return;
    }

    this.logger.error(`Error from device ${client.deviceId}: ${payload.error}`);

    // Notify admins
    this.notifyAdmins(ServerToAdminEvent.ERROR_OCCURRED, {
      deviceId: client.deviceId!,
      error: payload.error,
      timestamp: new Date(),
    } as AdminErrorPayload);
  }

  @SubscribeMessage(ClientToServerEvent.SCREENSHOT_UPLOAD)
  async handleScreenshotUpload(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ScreenshotUploadPayload,
  ) {
    if (!client.device) {
      this.logger.error('Screenshot upload from unauthenticated client');
      return;
    }

    this.logger.log(`Screenshot received from ${client.deviceId}`);

    try {
      // Save screenshot to database using authenticated device
      const screenshot = await this.screenshotsService.saveScreenshot(
        client.device.deviceId,
        payload.image,
        payload.currentUrl,
      );

      // Notify admins
      this.notifyAdmins(ServerToAdminEvent.SCREENSHOT_RECEIVED, {
        deviceId: client.deviceId!,
        screenshotId: screenshot.id,
        timestamp: new Date(),
      } as AdminScreenshotReceivedPayload);

      this.logger.log(`Screenshot saved with ID: ${screenshot.id}`);
    } catch (error) {
      this.logger.error(`Failed to save screenshot: ${error.message}`);
    }
  }

  // Public methods to send events to devices
  sendToDevice(deviceId: string, event: ServerToClientEvent, payload: any) {
    const socket = this.deviceSockets.get(deviceId);
    if (socket) {
      socket.emit(event, payload);
      this.logger.log(`Sent ${event} to device ${deviceId}`);
    } else {
      this.logger.warn(`Device ${deviceId} not connected`);
    }
  }

  sendToAllDevices(event: ServerToClientEvent, payload: any) {
    this.deviceSockets.forEach((socket, deviceId) => {
      socket.emit(event, payload);
    });
    this.logger.log(`Sent ${event} to all devices (${this.deviceSockets.size})`);
  }

  // Public methods to send events to admins
  notifyAdmins(event: ServerToAdminEvent, payload: any) {
    this.adminSockets.forEach((socket) => {
      socket.emit(event, payload);
    });
    this.logger.debug(`Sent ${event} to all admins (${this.adminSockets.size})`);
  }

  // Utility methods
  isDeviceConnected(deviceId: string): boolean {
    return this.deviceSockets.has(deviceId);
  }

  getConnectedDevices(): string[] {
    return Array.from(this.deviceSockets.keys());
  }

  getConnectedDeviceCount(): number {
    return this.deviceSockets.size;
  }

  getConnectedAdminCount(): number {
    return this.adminSockets.size;
  }
}
