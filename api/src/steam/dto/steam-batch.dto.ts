import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Max,
  Min,
} from 'class-validator';

/**
 * Consulta de precios de Steam para un lote de appids sin persistir.
 */
export class SteamBatchDto {
  @ApiProperty({
    description: 'Appids de Steam a consultar',
    type: [Number],
    example: [1091500, 1145360],
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2_147_483_647, { each: true })
  appIds!: number[];
}
