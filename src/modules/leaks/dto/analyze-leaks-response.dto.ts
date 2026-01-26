import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeakSeverity, LeakStatus } from '@prisma/client';

export class LocalizedLeakDto {
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

  @ApiProperty({ enum: LeakStatus, example: LeakStatus.LOCALIZED })
  status: LeakStatus;

  @ApiProperty({ example: '2024-01-25T10:00:00.000Z' })
  detectedAt: Date;

  @ApiProperty({ example: '2024-01-25T10:00:00.000Z' })
  timestamp: Date;

  @ApiProperty({
    description: 'Localization information',
    required: false,
  })
  localization?: {
    localizedNodeId: string;
    localizedNode?: {
      nodeId: string;
      nodeType: string;
      location: string | null;
    };
    localizationScore: number;
    topCandidates: Array<{
      nodeId: string;
      score: number;
      confidence: string;
    }>;
  };
}

export class AnalyzeLeaksSummaryDto {
  @ApiProperty({
    description: 'Total number of detections',
    example: 3,
  })
  totalDetections: number;

  @ApiProperty({
    description: 'Number of successfully localized leaks',
    example: 3,
  })
  localized: number;

  @ApiProperty({
    description: 'Breakdown by severity',
    example: {
      LOW: 1,
      MEDIUM: 1,
      HIGH: 1,
      CRITICAL: 0,
    },
  })
  severityBreakdown: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
}

export class AnalyzeLeaksResponseDto {
  @ApiProperty({
    description: 'Timestamp of the analysis',
    example: '2026-01-26T10:30:00Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Number of readings stored',
    example: 450,
  })
  readingsStored: number;

  @ApiProperty({
    description: 'List of leak detections with localization',
    type: [LocalizedLeakDto],
  })
  detections: LocalizedLeakDto[];

  @ApiProperty({
    description: 'Summary statistics',
    type: AnalyzeLeaksSummaryDto,
  })
  summary: AnalyzeLeaksSummaryDto;
}
