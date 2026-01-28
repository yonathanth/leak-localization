import { ApiProperty } from '@nestjs/swagger';
import { NodeType } from '@prisma/client';

export class CoverageByTypeDto {
  @ApiProperty({ enum: NodeType, example: NodeType.MAINLINE })
  nodeType: NodeType;

  @ApiProperty({ example: 10 })
  total: number;

  @ApiProperty({ example: 5 })
  withSensors: number;

  @ApiProperty({ example: 50.0, description: 'Coverage percentage' })
  coveragePercentage: number;
}

export class CoverageGapDto {
  @ApiProperty({ example: 'uuid-here' })
  nodeId: string;

  @ApiProperty({ enum: NodeType, example: NodeType.JUNCTION })
  nodeType: NodeType;

  @ApiProperty({ example: 'J5' })
  nodeIdLabel: string;

  @ApiProperty({
    example: 3,
    description: 'Number of child nodes (connectivity)',
  })
  connectivity: number;

  @ApiProperty({
    example: 'critical',
    enum: ['critical', 'high', 'medium', 'low'],
    description: 'Importance level for sensor placement',
  })
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export class SensorDistributionDto {
  @ApiProperty({ example: 'uuid-here', nullable: true })
  partitionId: string | null;

  @ApiProperty({ example: 'DMA_MAIN_01', nullable: true })
  partitionName: string | null;

  @ApiProperty({ example: 5 })
  sensorCount: number;
}

export class CoverageAnalysisDto {
  @ApiProperty({ example: 'uuid-here' })
  networkId: string;

  @ApiProperty({ example: 500, description: 'Total nodes in network' })
  totalNodes: number;

  @ApiProperty({
    example: 12,
    description: 'Number of nodes with sensors',
  })
  nodesWithSensors: number;

  @ApiProperty({
    example: 2.4,
    description: 'Overall coverage percentage',
  })
  overallCoveragePercentage: number;

  @ApiProperty({
    description: 'Coverage breakdown by node type',
    type: [CoverageByTypeDto],
  })
  coverageByType: CoverageByTypeDto[];

  @ApiProperty({
    description: 'Nodes without sensors, sorted by importance',
    type: [CoverageGapDto],
  })
  gaps: CoverageGapDto[];

  @ApiProperty({
    description: 'Sensor distribution across partitions/DMAs',
    type: [SensorDistributionDto],
  })
  sensorDistribution: SensorDistributionDto[];
}
