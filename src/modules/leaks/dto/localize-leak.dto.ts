import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class LocalizeLeakDto {
  @ApiPropertyOptional({
    description:
      'Specific detection ID to localize. If not provided, localizes all DETECTED leaks',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  detectionId?: string;

  @ApiPropertyOptional({
    description: 'Array of detection IDs to localize',
    example: ['uuid-1', 'uuid-2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  detectionIds?: string[];

  @ApiPropertyOptional({
    description:
      'Time window in seconds for baseline calculation (default: 3600 = 1 hour)',
    example: 3600,
    minimum: 300,
  })
  @IsOptional()
  @IsInt()
  @Min(300)
  baselineTimeWindow?: number;
}
