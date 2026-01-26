import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SensorType } from '@prisma/client';

export class SensorResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'MAIN_01' })
  sensorId: string;

  @ApiProperty({ enum: SensorType, example: SensorType.MAINLINE_FLOW })
  sensorType: SensorType;

  @ApiProperty({ example: 'uuid-here' })
  nodeId: string;

  @ApiPropertyOptional({ example: 'uuid-here' })
  partitionId?: string | null;

  @ApiPropertyOptional({ example: 'Mainline flow sensor' })
  description?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updatedAt: Date;
}

