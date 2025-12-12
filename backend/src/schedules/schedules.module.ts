import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { Schedule } from './entities/schedule.entity';
import { ScheduleItem } from './entities/schedule-item.entity';
import { DeviceSchedule } from './entities/device-schedule.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, ScheduleItem, DeviceSchedule]),
    forwardRef(() => WebSocketModule),
    forwardRef(() => DevicesModule),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
