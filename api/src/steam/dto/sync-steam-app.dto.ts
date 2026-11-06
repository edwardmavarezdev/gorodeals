import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * Sincroniza uno o varios appids de Steam contra un juego del catalogo.
 * El lote se limita a 100 appids por peticion para acotar el tiempo de la
 * llamada y el impacto sobre la API de Steam.
 */
export class SyncSteamAppDto {
  @ApiProperty({
    description: 'Juego del catalogo al que se vinculan las ofertas de Steam',
    format: 'uuid',
  })
  @IsUUID('4')
  gameId!: string;

  @ApiProperty({
    description: 'Appids de Steam a sincronizar',
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
