import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Device } from '../../devices/entities/device.entity';
import { Schedule } from './schedule.entity';

@Entity('device_schedules')
@Unique(['deviceId', 'scheduleId'])
export class DeviceSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  deviceId: number;

  @Column()
  scheduleId: number;

  @CreateDateColumn()
  assignedAt: Date;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device: Device;

  @ManyToOne(() => Schedule, (schedule) => schedule.deviceSchedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule: Schedule;
}
