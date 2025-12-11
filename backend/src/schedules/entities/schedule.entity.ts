import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ScheduleItem } from './schedule-item.entity';
import { DeviceSchedule } from './device-schedule.entity';

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ScheduleItem, (item) => item.schedule, { cascade: true })
  items: ScheduleItem[];

  @OneToMany(() => DeviceSchedule, (ds) => ds.schedule)
  deviceSchedules: DeviceSchedule[];
}
