import { IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AssignScheduleDto {
  @ApiProperty({ example: 1, description: 'Device ID to assign schedule to' })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  deviceId: number;

  @ApiProperty({ example: 1, description: 'Schedule ID to assign' })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  scheduleId: number;
}
