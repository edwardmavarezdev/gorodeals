import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Resultado de persistir un appid de Steam. */
export class SteamSyncItemResultDto {
  @ApiProperty({ description: 'Appid de Steam', example: 1091500 })
  appId!: number;

  @ApiProperty({
    description: 'Resultado de la operacion',
    enum: ['upserted', 'not_found', 'error'],
  })
  status!: 'upserted' | 'not_found' | 'error';

  @ApiPropertyOptional({
    description: 'uuid de la fila en store_products',
    nullable: true,
  })
  storeProductId?: string;

  @ApiPropertyOptional({
    description: 'uuid del juego vinculado',
    nullable: true,
  })
  gameId?: string;

  @ApiPropertyOptional({
    description: 'Precio actual persistido',
    nullable: true,
  })
  currentPrice?: number;

  @ApiPropertyOptional({
    description: 'Precio regular persistido',
    nullable: true,
  })
  regularPrice?: number;

  @ApiPropertyOptional({
    description: 'Descuento persistido',
    nullable: true,
  })
  discountPercent?: number;

  @ApiPropertyOptional({
    description: 'Moneda persistida',
    nullable: true,
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Motivo del no-ok',
    nullable: true,
  })
  message?: string;
}

/** Resumen de la sincronizacion de un lote de appids. */
export class SteamSyncSummaryDto {
  @ApiProperty({ description: 'Appids solicitados' })
  requested!: number;

  @ApiProperty({ description: 'Appids persistidos' })
  upserted!: number;

  @ApiProperty({ description: 'Appids sin datos en Steam' })
  notFound!: number;

  @ApiProperty({ description: 'Appids con error' })
  errors!: number;

  @ApiProperty({ type: [SteamSyncItemResultDto] })
  items!: SteamSyncItemResultDto[];
}
