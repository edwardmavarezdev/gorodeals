import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Punto de la serie de precios de una oferta.
 */
export class PriceHistoryPointDto {
  @ApiProperty({ description: 'UUID de la oferta (store_products)' })
  storeProductId!: string;

  @ApiProperty({ example: 'steam' })
  storeName!: string;

  @ApiProperty({ example: 59.99 })
  price!: number;

  @ApiPropertyOptional({ nullable: true, example: 79.99 })
  regularPrice!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 25 })
  discountPercent!: number | null;

  @ApiProperty({ example: '2026-11-03T00:00:00.000Z' })
  recordedAt!: string;
}
