import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { SensorType } from '@prisma/client';

export class CreateSensorDto {
  @ApiProperty({
    description: 'Unique sensor identifier (e.g., MAIN_01, JUNC_01, HH_001)',
    example: 'MAIN_01',
  })
  @IsString()
  sensorId: string;

  @ApiProperty({
    description: 'Type of flow sensor',
    enum: SensorType,
    example: SensorType.MAINLINE_FLOW,
  })
  @IsEnum(SensorType)
  sensorType: SensorType;

  @ApiProperty({
    description: 'Network node ID this sensor is attached to',
    example: 'uuid-here',
  })
  @IsString()
  nodeId: string;

  @ApiPropertyOptional({
    description: 'Network partition (DMA) ID this sensor belongs to',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.partitionId !== null)
  partitionId?: string | null;

  @ApiPropertyOptional({
    description: 'Sensor description',
    example: 'Mainline flow sensor at entry point',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the sensor is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

