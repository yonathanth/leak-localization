import { ApiProperty } from '@nestjs/swagger';
import { SensitivityMatrixEntryDto } from './sensitivity-matrix-entry.dto';

export class SensitivityMatrixResponseDto {
  @ApiProperty({
    description: 'Matrix entries',
    type: [SensitivityMatrixEntryDto],
  })
  data: SensitivityMatrixEntryDto[];

  @ApiProperty({
    description: 'Total number of entries',
    example: 1200,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 100,
  })
  limit: number;
}
