import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Fila del historico de precios de una oferta. */
export class PriceHistoryEntryDto {
  @ApiProperty({ description: 'Identificador de la fila de historico' })
  id!: string;

  @ApiProperty({ description: 'Oferta de tienda (uuid)' })
  storeProductId!: string;

  @ApiProperty({ description: 'Precio registrado' })
  price!: number;

  @ApiPropertyOptional({
    description: 'Precio regular en el momento del registro',
    nullable: true,
  })
  regularPrice!: number | null;

  @ApiPropertyOptional({
    description: 'Descuento en el momento del registro',
    nullable: true,
  })
  discountPercent!: number | null;

  @ApiProperty({ description: 'Origen del registro', example: 'sync' })
  source!: string;

  @ApiProperty({
    description: 'Momento del registro, truncado al dia (UTC)',
  })
  recordedAt!: string;
}
