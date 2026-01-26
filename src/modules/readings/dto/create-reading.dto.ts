import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  IsOptional,
  Min,
} from 'class-validator';
import { DataSource } from '@prisma/client';

export class CreateReadingDto {
  @ApiProperty({
    description: 'Sensor ID (e.g., MAIN_01, HH_001)',
    example: 'MAIN_01',
  })
  @IsString()
  sensorId: string;

  @ApiProperty({
    description: 'Flow value in liters per second (L/s)',
    example: 100.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  flowValue: number;

  @ApiProperty({
    description: 'Timestamp of the reading (ISO 8601 format)',
    example: '2024-01-15T10:00:00.000Z',
  })
  @IsDateString()
  timestamp: string;

  @ApiPropertyOptional({
    description: 'Data source of the reading',
    enum: DataSource,
    default: DataSource.MANUAL,
  })
  @IsOptional()
  @IsEnum(DataSource)
  source?: DataSource;
}

