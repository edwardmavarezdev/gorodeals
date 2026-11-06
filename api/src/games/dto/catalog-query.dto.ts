import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type CatalogSort = 'recent' | 'quality' | 'discount';

export const CATALOG_SORTS: readonly CatalogSort[] = [
  'recent',
  'quality',
  'discount',
];

export const CATALOG_STORES = ['steam', 'gog', 'nintendo'] as const;

/**
 * Filtros del catalogo. Todos son opcionales: sin filtros devuelve el
 * catalogo completo paginado.
 */
export class CatalogQueryDto {
  @ApiPropertyOptional({
    description: 'Pagina solicitada (1-based)',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Elementos por pagina',
    minimum: 1,
    maximum: 100,
    default: 24,
    example: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filtro por titulo (ILIKE)',
    maxLength: 100,
    example: 'yakuza',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    description:
      'Orden: recent = fecha de salida, quality = score de calidad, discount = mejor descuento',
    enum: CATALOG_SORTS,
    default: 'recent',
  })
  @IsOptional()
  @IsIn(CATALOG_SORTS)
  sort?: CatalogSort;

  @ApiPropertyOptional({
    description: 'Filtra por tienda',
    enum: CATALOG_STORES,
  })
  @IsOptional()
  @IsIn(CATALOG_STORES)
  store?: (typeof CATALOG_STORES)[number];
}
