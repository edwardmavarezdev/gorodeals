import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Oferta destacada de un juego. Es la mejor oferta vigente (mayor descuento y,
 * a igualdad, menor precio) entre las tiendas donde aparece el juego.
 */
export class BestOfferDto {
  @ApiProperty({ description: 'Tienda de la oferta', example: 'steam' })
  storeName!: string;

  @ApiProperty({
    description: 'Identificador del producto en la tienda',
    example: '1091500',
  })
  storeProductId!: string;

  @ApiProperty({ description: 'Precio actual', example: 59.99 })
  currentPrice!: number;

  @ApiProperty({ description: 'Precio de lista', example: 79.99 })
  regularPrice!: number;

  @ApiProperty({ description: 'Descuento en porcentaje', example: 25 })
  discountPercent!: number;

  @ApiProperty({ description: 'Moneda ISO 4217', example: 'USD' })
  currency!: string;

  @ApiPropertyOptional({
    description: 'URL de la oferta en la tienda',
    example: 'https://store.steampowered.com/app/1091500',
    nullable: true,
  })
  url!: string | null;

  @ApiProperty({
    description: 'Deal Score 0-10 de la oferta',
    example: 7.2,
  })
  dealScore!: number;
}
