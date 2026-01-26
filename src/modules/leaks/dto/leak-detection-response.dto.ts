import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeakSeverity, LeakStatus } from '@prisma/client';

export class LeakDetectionResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'uuid-here' })
  nodeId: string;

  @ApiPropertyOptional({ example: 'uuid-here' })
  partitionId?: string;

  @ApiProperty({ example: 15.5, description: 'Flow imbalance in L/s' })
  flowImbalance: number;

  @ApiProperty({ enum: LeakSeverity, example: LeakSeverity.MEDIUM })
  severity: LeakSeverity;

  @ApiProperty({ enum: LeakStatus, example: LeakStatus.DETECTED })
  status: LeakStatus;

  @ApiProperty({ example: '2024-01-25T10:00:00.000Z' })
  detectedAt: Date;

  @ApiProperty({ example: '2024-01-25T10:00:00.000Z' })
  timestamp: Date;

  @ApiPropertyOptional({ example: 300 })
  timeWindow?: number;

  @ApiPropertyOptional({ example: 5.0 })
  threshold?: number;

  @ApiProperty({ example: '2024-01-25T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-25T10:00:00.000Z' })
  updatedAt: Date;
}
