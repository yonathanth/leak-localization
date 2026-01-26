import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateReadingDto } from './create-reading.dto';

export class BatchReadingDto {
  @ApiProperty({
    description: 'Array of sensor readings',
    type: [CreateReadingDto],
    example: [
      {
        sensorId: 'MAIN_01',
        flowValue: 100.5,
        timestamp: '2024-01-15T10:00:00.000Z',
        source: 'MANUAL',
      },
      {
        sensorId: 'HH_001',
        flowValue: 10.1,
        timestamp: '2024-01-15T10:00:00.000Z',
        source: 'MANUAL',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReadingDto)
  readings: CreateReadingDto[];
}

