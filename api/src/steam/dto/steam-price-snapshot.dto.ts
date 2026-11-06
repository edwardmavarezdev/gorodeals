import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Snapshot de precio de un appid de Steam, tal y como lo devuelve la API.
 * Es la forma estable del contrato con el frontend.
 */
export class SteamPriceSnapshotDto {
  @ApiProperty({ description: 'Appid de Steam', example: 1091500 })
  appId!: number;

  @ApiPropertyOptional({
    description: 'Nombre del juego en Steam',
    nullable: true,
  })
  name!: string | null;

  @ApiProperty({ description: 'Moneda ISO 4217 del precio', example: 'USD' })
  currency!: string;

  @ApiProperty({ description: 'Precio actual', example: 19.99 })
  currentPrice!: number;

  @ApiProperty({ description: 'Precio regular', example: 39.99 })
  regularPrice!: number;

  @ApiProperty({ description: 'Descuento en porcentaje', example: 50 })
  discountPercent!: number;

  @ApiProperty({ description: 'El juego es gratis en la region' })
  isFree!: boolean;

  @ApiProperty({ description: 'Hay precio disponible' })
  isAvailable!: boolean;

  @ApiProperty({ description: 'URL de la ficha en la tienda' })
  url!: string;

  @ApiPropertyOptional({
    description: 'Valoracion de usuarios en porcentaje (0-100)',
    nullable: true,
  })
  ratingPercent!: number | null;

  @ApiPropertyOptional({
    description: 'Numero de votos de la valoracion',
    nullable: true,
  })
  ratingVotes!: number | null;

  @ApiPropertyOptional({
    description: 'Puntuacion de Metacritic',
    nullable: true,
  })
  metacriticScore!: number | null;

  @ApiPropertyOptional({
    description: 'Tamano de descarga en MB (null: Steam no lo publica)',
    nullable: true,
  })
  downloadSizeMb!: number | null;

  @ApiPropertyOptional({
    description: 'Fecha de salida publicada por Steam',
    nullable: true,
  })
  releaseDate!: string | null;

  @ApiProperty({ type: [String], description: 'Desarrolladores' })
  developers!: string[];

  @ApiProperty({ type: [String], description: 'Editores' })
  publishers!: string[];

  @ApiProperty({ type: [String], description: 'Generos' })
  genres!: string[];

  @ApiProperty({ type: [String], description: 'Plataformas' })
  platforms!: string[];

  @ApiPropertyOptional({
    description: 'URL de la imagen de cabecera',
    nullable: true,
  })
  headerImage!: string | null;
}
