import { ApiProperty } from '@nestjs/swagger';

/**
 * Punto de la serie temporal de precios de una oferta.
 */
export class PriceSeriesPointDto {
  @ApiProperty({ example: '2026-11-03T00:00:00.000Z' })
  recordedAt!: string;

  @ApiProperty({ example: 59.99 })
  price!: number;

  @ApiProperty({ example: 79.99 })
  regularPrice!: number | null;

  @ApiProperty({ example: 25 })
  discountPercent!: number | null;
}

/**
 * Serie temporal de precios de una oferta.
 */
export class PriceHistoryResponseDto {
  @ApiProperty({
    description: 'UUID de la oferta (store_products) de la que es la serie',
  })
  storeProductId!: string;

  @ApiProperty({ type: [PriceSeriesPointDto] })
  points!: PriceSeriesPointDto[];
}
