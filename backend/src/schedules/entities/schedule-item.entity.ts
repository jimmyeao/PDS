import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Schedule } from './schedule.entity';
import { Content } from '../../content/entities/content.entity';

@Entity('schedule_items')
export class ScheduleItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  scheduleId: number;

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

  @ManyToOne(() => Schedule, (schedule) => schedule.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scheduleId' })
  schedule: Schedule;

  @ManyToOne(() => Content, (content) => content.scheduleItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contentId' })
  content: Content;
}
