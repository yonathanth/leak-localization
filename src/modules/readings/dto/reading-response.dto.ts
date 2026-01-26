import { ApiProperty } from '@nestjs/swagger';
import { DataSource } from '@prisma/client';

export class ReadingResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'MAIN_01' })
  sensorId: string;

  @ApiProperty({ example: 100.5 })
  flowValue: number;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  timestamp: Date;

  @ApiProperty({ enum: DataSource, example: DataSource.MANUAL })
  source: DataSource;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  createdAt: Date;
}

