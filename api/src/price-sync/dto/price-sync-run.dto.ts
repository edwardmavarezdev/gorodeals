import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { StoreName } from '../../store-products/entities/store-product.entity.js';

/**
 * Parametros de la ejecucion manual del sync de precios.
 * Todos son opcionales: si se omiten se usa la configuracion del entorno.
 */
export class PriceSyncRunDto {
  @ApiPropertyOptional({
    description: 'Tiendas a sincronizar en esta ejecucion',
    enum: StoreName,
    isArray: true,
    example: [StoreName.STEAM],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(StoreName, { each: true })
  storeNames?: StoreName[];

  @ApiPropertyOptional({
    description: 'Numero de ofertas por lote al recorrer el catalogo',
    minimum: 1,
    maximum: 1000,
    default: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  batchSize?: number;

  @ApiPropertyOptional({
    description:
      'Paginas de catalogo de IGDB (limit/offset) a sincronizar antes de auditar precios',
    minimum: 0,
    maximum: 200,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(200)
  catalogPages?: number;

  @ApiPropertyOptional({
    description:
      'Limite de ofertas a procesar. Util para ejecuciones manuales acotadas',
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  maxProducts?: number;
}
