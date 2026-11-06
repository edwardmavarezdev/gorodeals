import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IgdbGameDto, IgdbSyncResultDto } from './dto/igdb-game.dto.js';
import { IgdbSearchQueryDto } from './dto/igdb-search-query.dto.js';
import { IgdbSyncDto } from './dto/igdb-sync.dto.js';
import { IgdbAdminGuard } from './igdb-admin.guard.js';
import { IgdbExceptionFilter } from './igdb-exception.filter.js';
import { IgdbService } from './igdb.service.js';

@ApiTags('igdb')
@UseFilters(IgdbExceptionFilter)
@Controller('igdb')
export class IgdbController {
  constructor(private readonly igdbService: IgdbService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Busca juegos por nombre en IGDB',
    description:
      'Consulta el catalogo de IGDB por nombre y devuelve metadatos normalizados sin persistirlos.',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Nombre del juego' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Numero maximo de resultados (1-50)',
  })
  @ApiOkResponse({ type: [IgdbGameDto] })
  @ApiBadRequestResponse({ description: 'Parametros invalidos' })
  @ApiUnauthorizedResponse({ description: 'Credenciales de IGDB invalidas' })
  async search(@Query() query: IgdbSearchQueryDto): Promise<IgdbGameDto[]> {
    return this.igdbService.searchByName(query.q, query.limit ?? 20);
  }

  @Get('games/search')
  @ApiOperation({
    summary: 'Busca juegos por nombre en IGDB (ruta alternativa)',
  })
  @ApiOkResponse({ type: [IgdbGameDto] })
  async searchGames(
    @Query() query: IgdbSearchQueryDto,
  ): Promise<IgdbGameDto[]> {
    return this.igdbService.searchByName(query.q, query.limit ?? 20);
  }

  @Get('games/:igdbId')
  @ApiOperation({
    summary: 'Obtiene los metadatos de un juego por su ID de IGDB',
  })
  @ApiOkResponse({ type: IgdbGameDto })
  @ApiNotFoundResponse({ description: 'El juego no existe en IGDB' })
  async findByIgdbId(@Param('igdbId') igdbId: string): Promise<IgdbGameDto> {
    const game = await this.igdbService.findByIgdbId(igdbId);
    if (!game) {
      throw new NotFoundException(
        `No existe ningun juego con igdbId ${igdbId}`,
      );
    }
    return game;
  }

  @Post('sync')
  @UseGuards(IgdbAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sincroniza un lote de juegos de IGDB contra la tabla games',
    description:
      'Upsert idempotente por igdb_id. Requiere la cabecera x-admin-secret.',
  })
  @ApiOkResponse({ type: IgdbSyncResultDto })
  @ApiForbiddenResponse({
    description: 'Secreto de administrador ausente o invalido',
  })
  async sync(@Body() dto: IgdbSyncDto): Promise<IgdbSyncResultDto> {
    return this.igdbService.sync(dto);
  }
}
