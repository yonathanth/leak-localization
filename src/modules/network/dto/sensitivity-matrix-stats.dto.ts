import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SensitivityMatrixStatsDto {
  @ApiProperty({
    description: 'Whether the sensitivity matrix exists',
    example: true,
  })
  exists: boolean;

  @ApiProperty({
    description: 'Total number of entries in the matrix',
    example: 250000,
  })
  totalEntries: number;

  @ApiPropertyOptional({
    description: 'Last time the matrix was computed',
    example: '2024-01-25T10:30:00.000Z',
  })
  lastComputed?: Date;
}
