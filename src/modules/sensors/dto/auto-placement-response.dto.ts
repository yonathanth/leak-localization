import { ApiProperty } from '@nestjs/swagger';
import { SensorType, NodeType } from '@prisma/client';

export class SensorPlacementDto {
  @ApiProperty({
    description: 'Sensor ID',
    example: 'MAIN_01',
  })
  sensorId: string;

  @ApiProperty({
    description: 'Sensor type',
    enum: SensorType,
    example: SensorType.MAINLINE_FLOW,
  })
  sensorType: SensorType;

  @ApiProperty({
    description: 'Node ID where sensor is placed',
    example: 'uuid-here',
  })
  nodeId: string;

  @ApiProperty({
    description: 'Node type',
    enum: NodeType,
    example: NodeType.MAINLINE,
  })
  nodeType: NodeType;

  @ApiProperty({
    description: 'DMA partition ID',
    example: 'uuid-here',
    nullable: true,
  })
  partitionId: string | null;

  @ApiProperty({
    description: 'Location description',
    example: 'Main Street Junction',
    nullable: true,
  })
  location: string | null;
}

export class AutoPlacementSummaryDto {
  @ApiProperty({
    description: 'Number of mainline sensors placed',
    example: 5,
  })
  mainlineSensors: number;

  @ApiProperty({
    description: 'Number of junction sensors placed',
    example: 6,
  })
  junctionSensors: number;

  @ApiProperty({
    description: 'Number of branch sensors placed',
    example: 1,
  })
  branchSensors: number;

  @ApiProperty({
    description: 'Number of household sensors placed',
    example: 0,
  })
  householdSensors: number;
}

export class AutoPlacementResponseDto {
  @ApiProperty({
    description: 'Total number of sensors placed',
    example: 450,
  })
  sensorsPlaced: number;

  @ApiProperty({
    description: 'List of placed sensors',
    type: [SensorPlacementDto],
  })
  sensors: SensorPlacementDto[];

  @ApiProperty({
    description: 'Summary statistics',
    type: AutoPlacementSummaryDto,
  })
  summary: AutoPlacementSummaryDto;
}
