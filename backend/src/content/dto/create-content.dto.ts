import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContentDto {
  @ApiProperty({ example: 'Company Homepage' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'https://example.com' })
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ example: 'Main company website', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  requiresInteraction?: boolean;

  @ApiProperty({ example: 'https://example.com/thumb.jpg', required: false })
  @IsUrl()
  @IsOptional()
  thumbnailUrl?: string;
}
