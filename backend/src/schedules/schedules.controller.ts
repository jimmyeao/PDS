import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateScheduleItemDto } from './dto/create-schedule-item.dto';
import { UpdateScheduleItemDto } from './dto/update-schedule-item.dto';
import { AssignScheduleDto } from './dto/assign-schedule.dto';
import { Schedule } from './entities/schedule.entity';
import { ScheduleItem } from './entities/schedule-item.entity';
import { DeviceSchedule } from './entities/device-schedule.entity';

@ApiTags('Schedules')
@ApiBearerAuth()
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  // Schedule Endpoints
  @Post()
  @ApiOperation({ summary: 'Create new schedule' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  create(@Body() createScheduleDto: CreateScheduleDto): Promise<Schedule> {
    return this.schedulesService.create(createScheduleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schedules' })
  @ApiResponse({ status: 200, description: 'Returns all schedules' })
  findAll(): Promise<Schedule[]> {
    return this.schedulesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get schedule by ID' })
  @ApiResponse({ status: 200, description: 'Returns schedule' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Schedule> {
    return this.schedulesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update schedule' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ): Promise<Schedule> {
    return this.schedulesService.update(id, updateScheduleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete schedule' })
  @ApiResponse({ status: 200, description: 'Schedule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.schedulesService.remove(id);
    return { message: 'Schedule deleted successfully' };
  }

  // Schedule Item Endpoints
  @Post('items')
  @ApiOperation({ summary: 'Add item to schedule' })
  @ApiResponse({ status: 201, description: 'Schedule item created successfully' })
  createItem(@Body() createScheduleItemDto: CreateScheduleItemDto): Promise<ScheduleItem> {
    return this.schedulesService.createItem(createScheduleItemDto);
  }

  @Get(':scheduleId/items')
  @ApiOperation({ summary: 'Get all items for a schedule' })
  @ApiResponse({ status: 200, description: 'Returns schedule items' })
  findAllItems(@Param('scheduleId', ParseIntPipe) scheduleId: number): Promise<ScheduleItem[]> {
    return this.schedulesService.findAllItems(scheduleId);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update schedule item' })
  @ApiResponse({ status: 200, description: 'Schedule item updated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule item not found' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateScheduleItemDto: UpdateScheduleItemDto,
  ): Promise<ScheduleItem> {
    return this.schedulesService.updateItem(id, updateScheduleItemDto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Delete schedule item' })
  @ApiResponse({ status: 200, description: 'Schedule item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Schedule item not found' })
  async removeItem(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.schedulesService.removeItem(id);
    return { message: 'Schedule item deleted successfully' };
  }

  // Device Schedule Assignment Endpoints
  @Post('assign')
  @ApiOperation({ summary: 'Assign schedule to device' })
  @ApiResponse({ status: 201, description: 'Schedule assigned successfully' })
  @ApiResponse({ status: 400, description: 'Schedule already assigned to device' })
  assignToDevice(@Body() assignScheduleDto: AssignScheduleDto): Promise<DeviceSchedule> {
    return this.schedulesService.assignScheduleToDevice(assignScheduleDto);
  }

  @Get('device/:deviceId')
  @ApiOperation({ summary: 'Get all schedules for a device' })
  @ApiResponse({ status: 200, description: 'Returns device schedules' })
  getDeviceSchedules(@Param('deviceId', ParseIntPipe) deviceId: number): Promise<Schedule[]> {
    return this.schedulesService.getDeviceSchedules(deviceId);
  }

  @Get(':scheduleId/devices')
  @ApiOperation({ summary: 'Get all devices assigned to a schedule' })
  @ApiResponse({ status: 200, description: 'Returns assigned devices' })
  getScheduleDevices(@Param('scheduleId', ParseIntPipe) scheduleId: number): Promise<DeviceSchedule[]> {
    return this.schedulesService.getScheduleDevices(scheduleId);
  }

  @Delete('assign/device/:deviceId/schedule/:scheduleId')
  @ApiOperation({ summary: 'Unassign schedule from device' })
  @ApiResponse({ status: 200, description: 'Schedule unassigned successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async unassignFromDevice(
    @Param('deviceId', ParseIntPipe) deviceId: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ): Promise<{ message: string }> {
    await this.schedulesService.unassignScheduleFromDevice(deviceId, scheduleId);
    return { message: 'Schedule unassigned successfully' };
  }
}
