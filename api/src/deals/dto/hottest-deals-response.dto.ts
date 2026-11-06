import { ApiProperty } from '@nestjs/swagger';
import { CatalogItemDto } from '../../games/dto/catalog-item.dto.js';

/**
 * Top de ofertas por Deal Score.
 */
export class HottestDealsResponseDto {
  @ApiProperty({ type: [CatalogItemDto] })
  items!: CatalogItemDto[];
}
