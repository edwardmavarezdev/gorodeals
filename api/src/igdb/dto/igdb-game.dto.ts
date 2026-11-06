import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IgdbGameDto {
  @ApiProperty({ description: 'Identificador numerico del juego en IGDB' })
  igdbId!: string;

  @ApiProperty({ description: 'Titulo del juego' })
  title!: string;

  @ApiProperty({ description: 'Slug del juego en IGDB' })
  slug!: string;

  @ApiPropertyOptional({ description: 'Resumen del juego', nullable: true })
  summary?: string | null;

  @ApiPropertyOptional({ description: 'Historia del juego', nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ description: 'URL de la caratula', nullable: true })
  coverUrl?: string | null;

  @ApiProperty({ description: 'URLs de capturas de pantalla', type: [String] })
  screenshots!: string[];

  @ApiProperty({ description: 'Generos', type: [String] })
  genres!: string[];

  @ApiProperty({ description: 'Plataformas', type: [String] })
  platforms!: string[];

  @ApiPropertyOptional({
    description: 'Fecha de lanzamiento (YYYY-MM-DD)',
    nullable: true,
  })
  releaseDate?: string | null;

  @ApiPropertyOptional({
    description: 'Puntuacion media de criticos externos (0-100)',
    nullable: true,
  })
  criticsScore?: number | null;

  @ApiPropertyOptional({
    description: 'Numero de puntuaciones de criticos externos',
    nullable: true,
  })
  criticsCount?: number | null;

  @ApiPropertyOptional({
    description: 'Puntuacion media de usuarios de IGDB y criticos (0-100)',
    nullable: true,
  })
  totalScore?: number | null;

  @ApiPropertyOptional({
    description: 'Numero total de puntuaciones de usuarios y criticos',
    nullable: true,
  })
  totalScoreCount?: number | null;

  @ApiPropertyOptional({
    description: 'Valoracion media de IGDB (0-100)',
    nullable: true,
  })
  rating?: number | null;

  @ApiPropertyOptional({
    description: 'Numero de valoraciones de IGDB',
    nullable: true,
  })
  ratingCount?: number | null;
}

export class IgdbSyncResultDto {
  @ApiProperty({ description: 'Juegos devueltos por IGDB' })
  fetched!: number;

  @ApiProperty({ description: 'Juegos insertados o actualizados' })
  upserted!: number;

  @ApiProperty({ description: 'Juegos omitidos por datos invalidos' })
  skipped!: number;
}
