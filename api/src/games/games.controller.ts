import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GamesService } from './games.service.js';
import { GameDetailQueryDto } from './dto/game-detail-query.dto.js';
import { GameDetailResponseDto } from './dto/game-detail-response.dto.js';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get(':slug')
  @ApiOperation({
    summary: 'Ficha completa de un juego',
    description:
      'Metadatos del juego, ofertas vigentes en cada tienda, historico de ' +
      'precios de los ultimos `months` meses (90 dias por defecto) y la saga ' +
      'a la que pertenece con su ruta de juego.',
  })
  @ApiOkResponse({ type: GameDetailResponseDto })
  @ApiNotFoundResponse({ description: 'El juego no existe' })
  async findBySlug(
    @Param('slug') slug: string,
    @Query() query: GameDetailQueryDto,
  ): Promise<GameDetailResponseDto> {
    return this.gamesService.findBySlug(slug, query.months);
  }
}
