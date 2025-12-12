import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Playlist } from './playlist.entity';
import { Content } from '../../content/entities/content.entity';

@Entity('playlist_items')
export class PlaylistItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  playlistId: number;

  @Column()
  contentId: number;

  @Column()
  displayDuration: number;

  @Column()
  orderIndex: number;

  @Column({ type: 'time', nullable: true })
  timeWindowStart: string;

  @Column({ type: 'time', nullable: true })
  timeWindowEnd: string;

  @Column({ type: 'text', nullable: true })
  daysOfWeek: string; // Store as JSON string

  @ManyToOne(() => Playlist, (playlist) => playlist.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlistId' })
  playlist: Playlist;

  @ManyToOne(() => Content, (content) => content.playlistItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contentId' })
  content: Content;
}
