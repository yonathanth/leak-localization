import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NodeType } from '@prisma/client';

export class NetworkNodeResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({
    description: 'Network ID this node belongs to',
    example: 'uuid-here',
  })
  networkId: string;

  @ApiProperty({ example: 'MAIN_01' })
  nodeId: string;

  @ApiProperty({ enum: NodeType, example: NodeType.MAINLINE })
  nodeType: NodeType;

  @ApiPropertyOptional({ example: null })
  parentId?: string | null;

  @ApiPropertyOptional({ example: 'ZONE_01' })
  zoneCode?: string;

  @ApiPropertyOptional({ example: 'BRANCH_01' })
  branchCode?: string;

  @ApiPropertyOptional({ example: 1 })
  sequenceNumber?: number;

  @ApiPropertyOptional({ example: 'Node_12' })
  epanetNodeId?: string;

  @ApiPropertyOptional({ example: 'Main branch West' })
  location?: string;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00.000Z' })
  updatedAt: Date;
}

