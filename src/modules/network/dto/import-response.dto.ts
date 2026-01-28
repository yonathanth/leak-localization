import { ApiProperty } from '@nestjs/swagger';

export class ImportResponseDto {
  @ApiProperty({
    description: 'Import status',
    example: 'success',
  })
  status: string;

  @ApiProperty({
    description: 'Number of nodes imported',
    example: 500,
  })
  nodesImported: number;

  @ApiProperty({
    description: 'Number of links imported',
    example: 600,
  })
  linksImported: number;

  @ApiProperty({
    description: 'Number of DMAs created',
    example: 5,
  })
  dmAsCreated: number;

  @ApiProperty({
    description: 'Import message',
    example: 'Network imported successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Network ID created during import (use this for subsequent operations)',
    example: 'uuid-here',
  })
  networkId: string;
}
