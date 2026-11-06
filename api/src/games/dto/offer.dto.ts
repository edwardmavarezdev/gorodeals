import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Oferta de un juego en una tienda concreta.
 */
export class OfferDto {
  @ApiProperty({ description: 'Tienda de la oferta', example: 'steam' })
  storeName!: string;

  @ApiProperty({ example: '1091500' })
  storeProductId!: string;

  @ApiProperty({ example: 59.99 })
  currentPrice!: number;

  @ApiProperty({ example: 79.99 })
  regularPrice!: number;

  @ApiProperty({ example: 25 })
  discountPercent!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  url!: string | null;

  @ApiProperty({ description: 'La oferta esta disponible en la tienda' })
  isAvailable!: boolean;

  @ApiPropertyOptional({ nullable: true, example: 39.99 })
  historicalLowPrice!: number | null;

  @ApiProperty({ description: 'Deal Score 0-10', example: 7.2 })
  dealScore!: number;

  @ApiProperty({ example: '2026-11-03T06:00:00.000Z' })
  lastCheckedAt!: string;
}
