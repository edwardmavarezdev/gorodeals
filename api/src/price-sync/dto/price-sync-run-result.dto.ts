import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Resultado de la sincronizacion de una tienda. */
export class PriceSyncStoreResultDto {
  @ApiProperty({ description: 'Tienda sincronizada', example: 'steam' })
  storeName!: string;

  @ApiProperty({ description: 'Ofertas procesadas' })
  processed!: number;

  @ApiProperty({ description: 'Ofertas actualizadas' })
  updated!: number;

  @ApiProperty({ description: 'Ofertas con variacion de precio' })
  changed!: number;

  @ApiProperty({ description: 'Ofertas sin variacion de precio' })
  unchanged!: number;

  @ApiProperty({ description: 'Ofertas sin datos en la tienda' })
  unavailable!: number;

  @ApiProperty({ description: 'Filas nuevas en price_history' })
  historyInserted!: number;

  @ApiProperty({ description: 'Errores aislados durante el proceso' })
  errors!: number;

  @ApiProperty({ description: 'Duracion del recorrido de la tienda (ms)' })
  durationMs!: number;
}

/** Totales aggregating de la ejecucion. */
export class PriceSyncTotalsDto {
  @ApiProperty()
  processed!: number;

  @ApiProperty()
  updated!: number;

  @ApiProperty()
  changed!: number;

  @ApiProperty()
  unchanged!: number;

  @ApiProperty()
  historyInserted!: number;

  @ApiProperty()
  unavailable!: number;

  @ApiProperty()
  errors!: number;
}

/** Resultado de la fase de catalogo de IGDB. */
export class PriceSyncCatalogResultDto {
  @ApiProperty({ description: 'Paginas de catalogo recorridas' })
  pages!: number;

  @ApiProperty({ description: 'Juegos leidos de IGDB' })
  fetched!: number;

  @ApiProperty({ description: 'Juegos insertados o actualizados' })
  upserted!: number;

  @ApiProperty({ description: 'Juegos omitidos' })
  skipped!: number;

  @ApiProperty({
    description: 'Errores durante la sincronizacion del catalogo',
  })
  errors!: number;
}

/** Resultado completo de una ejecucion del sync. */
export class PriceSyncRunResultDto {
  @ApiProperty({ description: 'Inicio de la ejecucion (ISO 8601)' })
  startedAt!: string;

  @ApiProperty({ description: 'Fin de la ejecucion (ISO 8601)' })
  finishedAt!: string;

  @ApiProperty({ description: 'Duracion total (ms)' })
  durationMs!: number;

  @ApiProperty({
    description: 'true si la ejecucion se omitio por solapamiento',
  })
  skipped!: boolean;

  @ApiPropertyOptional({ description: 'Motivo de la omision', nullable: true })
  skipReason!: string | null;

  @ApiPropertyOptional({
    type: [PriceSyncStoreResultDto],
    description: 'Resultado por tienda',
  })
  stores!: PriceSyncStoreResultDto[];

  @ApiProperty({ type: PriceSyncTotalsDto })
  totals!: PriceSyncTotalsDto;

  @ApiPropertyOptional({
    type: PriceSyncCatalogResultDto,
    nullable: true,
    description:
      'Resultado de la sincronizacion del catalogo de IGDB, si se ejecuto',
  })
  catalog!: PriceSyncCatalogResultDto | null;
}

/** Estado del modulo de sincronizacion. */
export class PriceSyncStatusDto {
  @ApiProperty({ description: 'Cron activo del modulo' })
  cron!: string;

  @ApiProperty({ description: 'Zona horaria del cron', example: 'UTC' })
  timezone!: string;

  @ApiProperty({ description: 'Sincronizacion activada' })
  enabled!: boolean;

  @ApiProperty({ description: 'Tamano de lote configurado' })
  batchSize!: number;

  @ApiProperty({ description: 'Tiendas configuradas', type: [String] })
  storeNames!: string[];

  @ApiProperty({ description: 'Hay una ejecucion en curso' })
  running!: boolean;

  @ApiPropertyOptional({
    type: PriceSyncRunResultDto,
    nullable: true,
    description: 'Resultado de la ultima ejecucion',
  })
  lastRun!: PriceSyncRunResultDto | null;

  @ApiProperty({
    description: 'Paginas de catalogo de IGDB sincronizadas por ciclo',
  })
  catalogPages!: number;

  @ApiPropertyOptional({
    description: 'Identificador de la ejecucion en curso',
    nullable: true,
  })
  runId!: string | null;
}
