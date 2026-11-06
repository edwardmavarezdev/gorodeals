import { ApiProperty } from '@nestjs/swagger';
import { CatalogItemDto } from './catalog-item.dto.js';

/**
 * Pagina del catalogo con el total de juegos que cumplen el filtro.
 */
export class CatalogResponseDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 24 })
  limit!: number;

  @ApiProperty({
    description: 'Total de juegos que cumplen el filtro (sin paginar)',
    example: 123,
  })
  total!: number;

  @ApiProperty({ type: [CatalogItemDto] })
  items!: CatalogItemDto[];
}
