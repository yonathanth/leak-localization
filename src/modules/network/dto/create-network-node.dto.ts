import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  ValidateIf,
} from 'class-validator';
import { NodeType } from '@prisma/client';

export class CreateNetworkNodeDto {
  @ApiProperty({
    description: 'Unique node identifier (e.g., MAIN_01, HH_001)',
    example: 'MAIN_01',
  })
  @IsString()
  nodeId: string;

  @ApiProperty({
    description: 'Type of network node',
    enum: NodeType,
    example: NodeType.MAINLINE,
  })
  @IsEnum(NodeType)
  nodeType: NodeType;

  @ApiPropertyOptional({
    description: 'Parent node ID (for hierarchical structure)',
    example: null,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.parentId !== null)
  parentId?: string | null;

  @ApiPropertyOptional({
    description: 'Zone code for hierarchical labeling',
    example: 'ZONE_01',
  })
  @IsOptional()
  @IsString()
  zoneCode?: string;

  @ApiPropertyOptional({
    description: 'Branch code for hierarchical labeling',
    example: 'BRANCH_01',
  })
  @IsOptional()
  @IsString()
  branchCode?: string;

  @ApiPropertyOptional({
    description: 'Sequence number within branch',
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sequenceNumber?: number;

  @ApiPropertyOptional({
    description: 'EPANET node ID if linked to EPANET model',
    example: 'Node_12',
  })
  @IsOptional()
  @IsString()
  epanetNodeId?: string;

  @ApiPropertyOptional({
    description: 'Location description or coordinates',
    example: 'Main branch West',
  })
  @IsOptional()
  @IsString()
  location?: string;
}

