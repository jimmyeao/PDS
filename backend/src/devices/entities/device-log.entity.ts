import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Device } from './device.entity';

@Entity('device_logs')
export class DeviceLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  deviceId: number;

  @Column({ nullable: true })
  logLevel: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Device, (device) => device.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device: Device;
}
