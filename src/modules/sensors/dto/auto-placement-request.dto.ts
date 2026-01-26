import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AutoPlacementRequestDto {
  @ApiPropertyOptional({
    description: 'Optional network ID to filter nodes',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsString()
  networkId?: string;
}
