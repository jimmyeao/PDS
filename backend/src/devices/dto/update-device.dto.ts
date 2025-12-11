import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceStatus } from '@kiosk/shared';

export class UpdateDeviceDto {
  @ApiProperty({ example: 'Lobby Display Updated', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'Updated description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'Building A - Floor 2', required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ enum: DeviceStatus, required: false })
  @IsEnum(DeviceStatus)
  @IsOptional()
  status?: DeviceStatus;
}
