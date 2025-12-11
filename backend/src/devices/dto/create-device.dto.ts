import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDeviceDto {
  @ApiProperty({ example: 'raspberry-pi-001' })
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ example: 'Lobby Display' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Main entrance display', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'Building A - Lobby', required: false })
  @IsString()
  @IsOptional()
  location?: string;
}
