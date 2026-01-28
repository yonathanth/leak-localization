import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeakNodeInfoDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'J5' })
  nodeId: string;

  @ApiProperty({ example: 'JUNCTION' })
  nodeType: string;

  @ApiPropertyOptional({ example: 'J5', nullable: true })
  epanetNodeId?: string | null;
}

export class SensorInfoDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'MAIN_01' })
  sensorId: string;

  @ApiProperty({ example: 'MAINLINE_FLOW' })
  sensorType: string;
}

export class SensitivityMatrixEntryDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({
    description: 'Network ID this matrix entry belongs to',
    example: 'uuid-here',
  })
  networkId: string;

  @ApiProperty({
    description: 'Sensitivity value (L/s per L/s)',
    example: 0.42,
  })
  sensitivityValue: number;

  @ApiProperty({
    description: 'Leak node information',
    type: LeakNodeInfoDto,
  })
  leakNode: LeakNodeInfoDto;

  @ApiProperty({
    description: 'Sensor information',
    type: SensorInfoDto,
  })
  sensor: SensorInfoDto;

  @ApiProperty({ example: '2024-01-25T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-25T10:00:00.000Z' })
  updatedAt: Date;
}
