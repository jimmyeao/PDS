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
import { Logger, UseGuards } from '@nestjs/common';
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
} from '@kiosk/shared';

interface AuthenticatedSocket extends Socket {
  deviceId?: string;
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
      } else if (role === 'device') {
        const deviceId = client.handshake.auth?.deviceId;
        if (!deviceId) {
          this.logger.warn(`Device connection rejected: No deviceId provided`);
          client.disconnect();
          return;
        }

        client.role = 'device';
        client.deviceId = deviceId;
        this.deviceSockets.set(deviceId, client);
        this.logger.log(`Device connected: ${deviceId} (Socket: ${client.id})`);

        // Notify admins
        this.notifyAdmins(ServerToAdminEvent.DEVICE_CONNECTED, {
          deviceId,
          timestamp: new Date(),
        } as AdminDeviceConnectedPayload);
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
    this.logger.log(`Device registered: ${payload.deviceId}`);
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
    this.logger.log(`Device status update: ${payload.deviceId} - ${payload.status}`);

    // Notify admins
    this.notifyAdmins(ServerToAdminEvent.DEVICE_STATUS_CHANGED, {
      deviceId: payload.deviceId,
      status: payload.status,
      timestamp: new Date(),
    } as AdminDeviceStatusPayload);
  }

  @SubscribeMessage(ClientToServerEvent.ERROR_REPORT)
  handleErrorReport(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ErrorReportPayload,
  ) {
    this.logger.error(`Error from device ${payload.deviceId}: ${payload.error}`);

    // Notify admins
    this.notifyAdmins(ServerToAdminEvent.ERROR_OCCURRED, {
      deviceId: payload.deviceId,
      error: payload.error,
      timestamp: new Date(),
    } as AdminErrorPayload);
  }

  @SubscribeMessage(ClientToServerEvent.SCREENSHOT_UPLOAD)
  handleScreenshotUpload(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ScreenshotUploadPayload,
  ) {
    this.logger.log(`Screenshot received from ${payload.deviceId}`);
    // Screenshot handling will be done via HTTP endpoint
    // This is just a notification
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
