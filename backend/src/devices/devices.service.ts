import { Injectable, NotFoundException, ConflictException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Device } from './entities/device.entity';
import { DeviceLog } from './entities/device-log.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceStatus, ServerToAdminEvent, AdminDeviceStatusPayload } from '@kiosk/shared';
import { WebSocketGatewayService } from '../websocket/websocket.gateway';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private devicesRepository: Repository<Device>,
    @InjectRepository(DeviceLog)
    private deviceLogsRepository: Repository<DeviceLog>,
    @Inject(forwardRef(() => WebSocketGatewayService))
    private websocketGateway: WebSocketGatewayService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async create(createDeviceDto: CreateDeviceDto): Promise<Device & { token?: string }> {
    // Check if device already exists
    const existingDevice = await this.devicesRepository.findOne({
      where: { deviceId: createDeviceDto.deviceId },
    });

    if (existingDevice) {
      throw new ConflictException('Device with this ID already exists');
    }

    const device = this.devicesRepository.create(createDeviceDto);
    const savedDevice = await this.devicesRepository.save(device);

    // Generate JWT token for the device
    const secret = this.configService.get<string>('jwt.secret') || 'dev-secret-key';
    const token = await this.jwtService.signAsync(
      {
        sub: savedDevice.id,
        deviceId: savedDevice.deviceId,
        type: 'device',
      },
      {
        secret,
        expiresIn: '365d', // Device tokens last 1 year
      },
    );

    // Return device with token (token is only shown once)
    return { ...savedDevice, token };
  }

  async findAll(): Promise<Device[]> {
    return this.devicesRepository.find({
      order: { registeredAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Device> {
    const device = await this.devicesRepository.findOne({ where: { id } });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    return device;
  }

  async findByDeviceId(deviceId: string): Promise<Device> {
    const device = await this.devicesRepository.findOne({ where: { deviceId } });

    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }

    return device;
  }

  async update(id: number, updateDeviceDto: UpdateDeviceDto): Promise<Device> {
    const device = await this.findOne(id);

    Object.assign(device, updateDeviceDto);
    return this.devicesRepository.save(device);
  }

  async remove(id: number): Promise<void> {
    const device = await this.findOne(id);
    await this.devicesRepository.remove(device);
  }

  async updateStatus(deviceId: string, status: DeviceStatus, message?: string): Promise<Device> {
    const device = await this.findByDeviceId(deviceId);
    device.status = status;
    device.lastSeen = new Date();

    await this.devicesRepository.save(device);

    // Notify admins via WebSocket
    this.websocketGateway.notifyAdmins(ServerToAdminEvent.DEVICE_STATUS_CHANGED, {
      deviceId,
      status,
      timestamp: new Date(),
    } as AdminDeviceStatusPayload);

    // Log status change
    if (message) {
      await this.logDevice(device.id, 'info', message);
    }

    return device;
  }

  async updateDeviceInfo(
    deviceId: string,
    ipAddress: string,
    screenResolution?: string,
    osVersion?: string,
    clientVersion?: string,
  ): Promise<Device> {
    const device = await this.findByDeviceId(deviceId);

    device.ipAddress = ipAddress;
    device.screenResolution = screenResolution || device.screenResolution;
    device.osVersion = osVersion || device.osVersion;
    device.clientVersion = clientVersion || device.clientVersion;
    device.lastSeen = new Date();

    return this.devicesRepository.save(device);
  }

  async logDevice(deviceId: number, logLevel: string, message: string, metadata?: any): Promise<void> {
    const log = this.deviceLogsRepository.create({
      deviceId,
      logLevel,
      message,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });

    await this.deviceLogsRepository.save(log);
  }

  async getDeviceLogs(id: number, limit: number = 100): Promise<DeviceLog[]> {
    return this.deviceLogsRepository.find({
      where: { deviceId: id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
