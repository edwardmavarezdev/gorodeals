import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Juego dentro de la ruta de una saga (resolucion minima para el frontend).
 */
export class RouteGameDto {
  @ApiProperty({ example: 'yakuza-0' })
  slug!: string;

  @ApiProperty({ example: 'Yakuza 0' })
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  coverUrl!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2015-12-18' })
  releaseDate!: string | null;

  @ApiProperty({ example: 8.1 })
  qualityScore!: number;
}

/**
 * Entrada de la ruta de una saga: posicion, nota del editor y juego.
 */
export class RouteEntryDto {
  @ApiProperty({ example: 1 })
  position!: number;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty({ type: RouteGameDto })
  game!: RouteGameDto;
}

/**
 * Saga con su ruta de juego recomendada.
 */
export class FranchiseRouteDto {
  @ApiProperty({ example: 'Like a Dragon' })
  name!: string;

  @ApiProperty({ example: 'like-a-dragon' })
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ type: [RouteEntryDto] })
  route!: RouteEntryDto[];
}
