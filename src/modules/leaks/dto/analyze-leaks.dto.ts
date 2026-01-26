import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class SensorReadingDto {
  @ApiProperty({
    description: 'Sensor ID',
    example: 'MAIN_01',
  })
  @IsString()
  sensorId: string;

  @ApiProperty({
    description: 'Flow value in L/s',
    example: 150.5,
  })
  @IsNumber()
  flowValue: number;
}

export class AnalyzeLeaksDto {
  @ApiProperty({
    description: 'Timestamp for the sensor readings',
    example: '2026-01-26T10:30:00Z',
  })
  @IsDateString()
  timestamp: string;

  @ApiProperty({
    description: 'Array of sensor readings (simultaneous)',
    type: [SensorReadingDto],
    example: [
      { sensorId: 'MAIN_01', flowValue: 150.5 },
      { sensorId: 'HH_001', flowValue: 2.3 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SensorReadingDto)
  readings: SensorReadingDto[];
}
