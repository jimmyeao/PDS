import { IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AssignPlaylistDto {
  @ApiProperty({ example: 1, description: 'Device ID to assign playlist to' })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  deviceId: number;

  @ApiProperty({ example: 1, description: 'Playlist ID to assign' })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  playlistId: number;
}
