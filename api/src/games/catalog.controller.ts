import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GamesService } from './games.service.js';
import { CatalogQueryDto } from './dto/catalog-query.dto.js';
import { CatalogResponseDto } from './dto/catalog-response.dto.js';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  @ApiOperation({
    summary: 'Catalogo de juegos paginado',
    description:
      'Pagina del catalogo con la mejor oferta de cada juego. Admite filtro ' +
      'por titulo (`q`), por tienda (`store`) y tres ordenaciones: `recent` ' +
      '(fecha de salida), `quality` (score de calidad) y `discount` (mejor ' +
      'descuento primero).',
  })
  @ApiOkResponse({ type: CatalogResponseDto })
  async list(@Query() query: CatalogQueryDto): Promise<CatalogResponseDto> {
    return this.gamesService.listCatalog(query);
  }
}
