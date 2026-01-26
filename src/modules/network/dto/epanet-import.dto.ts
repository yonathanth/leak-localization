import { ApiProperty } from '@nestjs/swagger';

export class EpanetImportDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'EPANET .inp file to import',
    example: 'network.inp',
  })
  file: any;
}
