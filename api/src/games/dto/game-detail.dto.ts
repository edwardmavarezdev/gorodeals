import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Ficha completa de un juego.
 */
export class GameDetailDto {
  @ApiProperty({ description: 'UUID del juego' })
  id!: string;

  @ApiProperty({ example: 'like-a-dragon-infinite-wealth' })
  slug!: string;

  @ApiProperty({ example: 'Like a Dragon: Infinite Wealth' })
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  summary!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  coverUrl!: string | null;

  @ApiProperty({ type: [String] })
  screenshots!: string[];

  @ApiProperty({ type: [String] })
  genres!: string[];

  @ApiProperty({ type: [String] })
  platforms!: string[];

  @ApiPropertyOptional({ nullable: true, example: '2023-01-01' })
  releaseDate!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 87 })
  metacriticScore!: number | null;

  @ApiProperty({ description: 'Score de calidad 0-10', example: 8.4 })
  qualityScore!: number;
}
