import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsDateString,
  IsInt,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

export class DetectLeaksDto {
  @ApiPropertyOptional({
    description: 'Network ID to detect leaks in',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  networkId?: string;

  @ApiPropertyOptional({
    description:
      'Specific timestamp to analyze (ISO 8601). If not provided, uses current time',
    example: '2024-01-25T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Time window in seconds for analysis (default: 300 = 5 minutes)',
    example: 300,
    minimum: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  timeWindow?: number;

  @ApiPropertyOptional({
    description: 'Flow imbalance threshold in L/s (default: 5.0)',
    example: 5.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  threshold?: number;

  @ApiPropertyOptional({
    description:
      'Specific node ID to check (if not provided, checks all nodes)',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  nodeId?: string;

  @ApiPropertyOptional({
    description:
      'Specific DMA partition ID to check (if not provided, checks all DMAs)',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  partitionId?: string;
}
