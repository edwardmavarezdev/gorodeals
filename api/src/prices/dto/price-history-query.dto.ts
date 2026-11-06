import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Filtros del historico de precios.
 */
export class PriceHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Meses de historico a devolver (por defecto 12)',
    minimum: 1,
    maximum: 60,
    default: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  months?: number;

  @ApiPropertyOptional({
    description:
      'Oferta concreta a consultar: UUID de store_products o el id de ' +
      'producto de la tienda (por ejemplo el appid de Steam)',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  storeProductId?: string;
}
