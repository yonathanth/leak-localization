import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { LeakStatus, LeakSeverity } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryLeakDetectionsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by network ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  networkId?: string;

  @ApiPropertyOptional({
    description: 'Filter by node ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  nodeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by partition ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  partitionId?: string;

  @ApiPropertyOptional({
    description: 'Filter by leak status',
    enum: LeakStatus,
    example: LeakStatus.DETECTED,
  })
  @IsOptional()
  @IsEnum(LeakStatus)
  status?: LeakStatus;

  @ApiPropertyOptional({
    description: 'Filter by leak severity',
    enum: LeakSeverity,
    example: LeakSeverity.MEDIUM,
  })
  @IsOptional()
  @IsEnum(LeakSeverity)
  severity?: LeakSeverity;

  @ApiPropertyOptional({
    description: 'Start date for filtering (ISO 8601)',
    example: '2024-01-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (ISO 8601)',
    example: '2024-01-15T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
