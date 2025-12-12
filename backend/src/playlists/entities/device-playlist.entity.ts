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
import { Playlist } from './playlist.entity';

@Entity('device_playlists')
@Unique(['deviceId', 'playlistId'])
export class DevicePlaylist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  deviceId: number;

  @Column()
  playlistId: number;

  @CreateDateColumn()
  assignedAt: Date;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device: Device;

  @ManyToOne(() => Playlist, (playlist) => playlist.devicePlaylists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlistId' })
  playlist: Playlist;
}
