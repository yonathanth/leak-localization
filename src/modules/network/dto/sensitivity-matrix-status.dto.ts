import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SensitivityMatrixStatsDto } from './sensitivity-matrix-stats.dto';

export class SensitivityMatrixStatusDto {
  @ApiProperty({
    description: 'Generation status',
    enum: ['not_started', 'in_progress', 'completed', 'error'],
    example: 'completed',
  })
  status: 'not_started' | 'in_progress' | 'completed' | 'error';

  @ApiPropertyOptional({
    description: 'Generation progress information',
    example: {
      nodesProcessed: 150,
      totalNodes: 200,
      percentage: 75,
    },
  })
  progress?: {
    nodesProcessed: number;
    totalNodes: number;
    percentage: number;
  };

  @ApiPropertyOptional({
    description: 'Matrix statistics',
    type: SensitivityMatrixStatsDto,
  })
  matrixStats?: SensitivityMatrixStatsDto;

  @ApiPropertyOptional({
    description: 'Error message if status is error',
    example: 'Failed to generate matrix',
  })
  error?: string;
}
