export interface Schedule {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  items?: ScheduleItem[];
  deviceSchedules?: DeviceScheduleAssignment[];
}

export interface ScheduleItem {
  id: number;
  scheduleId: number;
  contentId: number;
  displayDuration: number; // seconds
  orderIndex: number;
  timeWindowStart?: string; // HH:MM format
  timeWindowEnd?: string; // HH:MM format
  daysOfWeek?: string; // JSON string of number array from database, or number[] when creating
  content?: {
    id: number;
    name: string;
    url: string;
    requiresInteraction: boolean;
  };
}

export interface CreateScheduleDto {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateScheduleDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateScheduleItemDto {
  scheduleId: number;
  contentId: number;
  displayDuration: number;
  orderIndex: number;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  daysOfWeek?: number[];
}

export interface UpdateScheduleItemDto {
  displayDuration?: number;
  orderIndex?: number;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  daysOfWeek?: number[];
}

export interface DeviceScheduleAssignment {
  id: number;
  deviceId: number;
  scheduleId: number;
  assignedAt: Date;
}
