import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BestOfferDto } from './best-offer.dto.js';

/**
 * Juego del catalogo con su mejor oferta. Es la forma que consumen el
 * listado (`/catalog`) y el top de ofertas (`/deals/hottest`).
 */
export class CatalogItemDto {
  @ApiProperty({ description: 'UUID del juego' })
  id!: string;

  @ApiProperty({ example: 'like-a-dragon-infinite-wealth' })
  slug!: string;

  @ApiProperty({ example: 'Like a Dragon: Infinite Wealth' })
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  summary!: string | null;

  @ApiPropertyOptional({ nullable: true })
  coverUrl!: string | null;

  @ApiProperty({ type: [String], example: ['RPG'] })
  genres!: string[];

  @ApiProperty({ type: [String], example: ['PS5'] })
  platforms!: string[];

  @ApiPropertyOptional({ nullable: true, example: '2023-01-01' })
  releaseDate!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 87 })
  metacriticScore!: number | null;

  @ApiProperty({ description: 'Score de calidad 0-10', example: 8.4 })
  qualityScore!: number;

  @ApiProperty({
    description: 'Mejor oferta vigente; null si el juego no tiene ofertas',
    type: BestOfferDto,
    nullable: true,
  })
  bestOffer!: BestOfferDto | null;
}
