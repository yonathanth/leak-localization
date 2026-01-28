import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryReadingsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by network ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  networkId?: string;

  @ApiPropertyOptional({
    description: 'Filter by sensor ID',
    example: 'MAIN_01',
  })
  @IsOptional()
  @IsString()
  sensorId?: string;

  @ApiPropertyOptional({
    description: 'Start date for filtering readings (ISO 8601)',
    example: '2024-01-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering readings (ISO 8601)',
    example: '2024-01-15T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

