import { IsNumber, IsOptional, IsString, IsArray, Min, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateScheduleItemDto {
  @ApiProperty({ example: 45, description: 'Display duration in seconds', required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  displayDuration?: number;

  @ApiProperty({ example: 1, description: 'Order in the rotation sequence', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  orderIndex?: number;

  @ApiProperty({ example: '09:00', required: false, description: 'Start time in HH:MM format' })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'timeWindowStart must be in HH:MM format',
  })
  timeWindowStart?: string;

  @ApiProperty({ example: '17:00', required: false, description: 'End time in HH:MM format' })
  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'timeWindowEnd must be in HH:MM format',
  })
  timeWindowEnd?: string;

  @ApiProperty({
    example: [1, 2, 3, 4, 5],
    required: false,
    description: 'Days of week (0=Sunday, 6=Saturday)',
    type: [Number]
  })
  @IsArray()
  @IsOptional()
  @IsNumber({}, { each: true })
  daysOfWeek?: number[];
}
