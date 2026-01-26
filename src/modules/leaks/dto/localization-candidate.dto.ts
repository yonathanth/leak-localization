import { ApiProperty } from '@nestjs/swagger';
import { NodeType } from '@prisma/client';

export class LocalizationCandidateDto {
  @ApiProperty({ example: 'uuid-here' })
  nodeId: string;

  @ApiProperty({ example: 'MAIN_01' })
  nodeIdString: string;

  @ApiProperty({ description: 'Localization score 0-1', example: 0.85 })
  score: number;

  @ApiProperty({ enum: NodeType, example: NodeType.JUNCTION })
  nodeType: NodeType;
}
