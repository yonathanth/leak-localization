import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QuerySensitivityMatrixDto extends PaginationDto {
  @ApiProperty({
    description: 'Network ID (required)',
    example: 'uuid-here',
  })
  @IsString()
  networkId: string;

  @ApiPropertyOptional({
    description: 'Filter by leak node ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  leakNodeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by sensor ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  sensorId?: string;
}
