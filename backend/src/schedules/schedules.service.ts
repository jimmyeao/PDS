import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';
import { ScheduleItem } from './entities/schedule-item.entity';
import { DeviceSchedule } from './entities/device-schedule.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateScheduleItemDto } from './dto/create-schedule-item.dto';
import { UpdateScheduleItemDto } from './dto/update-schedule-item.dto';
import { AssignScheduleDto } from './dto/assign-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private scheduleRepository: Repository<Schedule>,
    @InjectRepository(ScheduleItem)
    private scheduleItemRepository: Repository<ScheduleItem>,
    @InjectRepository(DeviceSchedule)
    private deviceScheduleRepository: Repository<DeviceSchedule>,
  ) {}

  // Schedule CRUD Operations
  async create(createScheduleDto: CreateScheduleDto): Promise<Schedule> {
    const schedule = this.scheduleRepository.create(createScheduleDto);
    return this.scheduleRepository.save(schedule);
  }

  async findAll(): Promise<Schedule[]> {
    return this.scheduleRepository.find({
      relations: ['items', 'items.content', 'deviceSchedules', 'deviceSchedules.device'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Schedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
      relations: ['items', 'items.content', 'deviceSchedules', 'deviceSchedules.device'],
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    return schedule;
  }

  async update(id: number, updateScheduleDto: UpdateScheduleDto): Promise<Schedule> {
    const schedule = await this.findOne(id);
    Object.assign(schedule, updateScheduleDto);
    return this.scheduleRepository.save(schedule);
  }

  async remove(id: number): Promise<void> {
    const schedule = await this.findOne(id);
    await this.scheduleRepository.remove(schedule);
  }

  // Schedule Item Operations
  async createItem(createScheduleItemDto: CreateScheduleItemDto): Promise<ScheduleItem> {
    // Verify schedule exists
    await this.findOne(createScheduleItemDto.scheduleId);

    // Convert daysOfWeek array to JSON string for storage
    const itemData = {
      scheduleId: createScheduleItemDto.scheduleId,
      contentId: createScheduleItemDto.contentId,
      displayDuration: createScheduleItemDto.displayDuration,
      orderIndex: createScheduleItemDto.orderIndex,
      timeWindowStart: createScheduleItemDto.timeWindowStart,
      timeWindowEnd: createScheduleItemDto.timeWindowEnd,
      daysOfWeek: createScheduleItemDto.daysOfWeek
        ? JSON.stringify(createScheduleItemDto.daysOfWeek)
        : undefined,
    };

    const item = this.scheduleItemRepository.create(itemData);
    return this.scheduleItemRepository.save(item);
  }

  async findAllItems(scheduleId: number): Promise<ScheduleItem[]> {
    return this.scheduleItemRepository.find({
      where: { scheduleId },
      relations: ['content'],
      order: { orderIndex: 'ASC' },
    });
  }

  async findOneItem(id: number): Promise<ScheduleItem> {
    const item = await this.scheduleItemRepository.findOne({
      where: { id },
      relations: ['content', 'schedule'],
    });

    if (!item) {
      throw new NotFoundException(`Schedule item with ID ${id} not found`);
    }

    return item;
  }

  async updateItem(id: number, updateScheduleItemDto: UpdateScheduleItemDto): Promise<ScheduleItem> {
    const item = await this.findOneItem(id);

    // Convert daysOfWeek array to JSON string for storage if provided
    const updateData = {
      ...updateScheduleItemDto,
      daysOfWeek: updateScheduleItemDto.daysOfWeek
        ? JSON.stringify(updateScheduleItemDto.daysOfWeek)
        : item.daysOfWeek,
    };

    Object.assign(item, updateData);
    return this.scheduleItemRepository.save(item);
  }

  async removeItem(id: number): Promise<void> {
    const item = await this.findOneItem(id);
    await this.scheduleItemRepository.remove(item);
  }

  // Device Schedule Assignment Operations
  async assignScheduleToDevice(assignScheduleDto: AssignScheduleDto): Promise<DeviceSchedule> {
    const { deviceId, scheduleId } = assignScheduleDto;

    // Check if assignment already exists
    const existing = await this.deviceScheduleRepository.findOne({
      where: { deviceId, scheduleId },
    });

    if (existing) {
      throw new BadRequestException('This schedule is already assigned to this device');
    }

    const assignment = this.deviceScheduleRepository.create(assignScheduleDto);
    return this.deviceScheduleRepository.save(assignment);
  }

  async getDeviceSchedules(deviceId: number): Promise<Schedule[]> {
    const assignments = await this.deviceScheduleRepository.find({
      where: { deviceId },
      relations: ['schedule', 'schedule.items', 'schedule.items.content'],
    });

    return assignments.map(assignment => assignment.schedule);
  }

  async getScheduleDevices(scheduleId: number): Promise<DeviceSchedule[]> {
    return this.deviceScheduleRepository.find({
      where: { scheduleId },
      relations: ['device'],
      order: { assignedAt: 'DESC' },
    });
  }

  async unassignScheduleFromDevice(deviceId: number, scheduleId: number): Promise<void> {
    const assignment = await this.deviceScheduleRepository.findOne({
      where: { deviceId, scheduleId },
    });

    if (!assignment) {
      throw new NotFoundException('Schedule assignment not found');
    }

    await this.deviceScheduleRepository.remove(assignment);
  }

  async getActiveScheduleByDeviceStringId(deviceStringId: string): Promise<ScheduleItem[]> {
    // First, we need to get the device's numeric ID from its string ID
    // Since we don't have DevicesService injected here, we'll query directly
    const Device = await this.deviceScheduleRepository.manager.query(
      'SELECT id FROM devices WHERE deviceId = ?',
      [deviceStringId]
    );

    if (!Device || Device.length === 0) {
      return [];
    }

    const deviceId = Device[0].id;
    const schedules = await this.getDeviceSchedules(deviceId);

    // Find the active schedule
    const activeSchedule = schedules.find(s => s.isActive);

    if (!activeSchedule || !activeSchedule.items) {
      return [];
    }

    return activeSchedule.items;
  }
}
