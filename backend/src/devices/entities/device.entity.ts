import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { DeviceLog } from './device-log.entity';
import { DeviceStatus } from '@kiosk/shared';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  deviceId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  location: string;

  @Column({ default: DeviceStatus.OFFLINE })
  status: DeviceStatus;

  @Column({ type: 'datetime', nullable: true })
  lastSeen: Date;

  @Column({ nullable: true })
  screenResolution: string;

  @Column({ nullable: true })
  osVersion: string;

  @Column({ nullable: true })
  clientVersion: string;

  @CreateDateColumn()
  registeredAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => DeviceLog, (log) => log.device)
  logs: DeviceLog[];
}
