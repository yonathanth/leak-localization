import { ApiProperty } from '@nestjs/swagger';

export class LocalizationResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  detectionId: string;

  @ApiProperty({ example: 'uuid-here' })
  originalNodeId: string;

  @ApiProperty({ example: 'uuid-here' })
  localizedNodeId: string;

  @ApiProperty({ description: 'Confidence score 0-1', example: 0.85 })
  localizationScore: number;

  @ApiProperty({ example: '2024-01-25T10:00:00.000Z' })
  localizedAt: Date;

  @ApiProperty({
    type: [Object],
    description: 'Top candidate nodes with scores',
  })
  candidateNodes: Array<{
    nodeId: string;
    nodeIdString: string;
    score: number;
  }>;
}
