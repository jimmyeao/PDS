import { IsString, IsOptional, IsBoolean, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateContentDto {
  @ApiProperty({ example: 'Updated Name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'https://example.com/updated', required: false })
  @IsUrl()
  @IsOptional()
  url?: string;

  @ApiProperty({ example: 'Updated description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  requiresInteraction?: boolean;

  @ApiProperty({ example: 'https://example.com/new-thumb.jpg', required: false })
  @IsUrl()
  @IsOptional()
  thumbnailUrl?: string;
}
