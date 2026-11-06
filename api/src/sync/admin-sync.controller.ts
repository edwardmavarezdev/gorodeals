import {
  Query,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SyncRandomGamesDto } from './dto/sync-random-games.dto.js';
import { SyncRandomGamesService } from './sync-random-games.service.js';
import { parseSyncPlatforms, SyncRandomGamesResult } from './sync.types.js';

/**
 * Endpoint de administracion para cargar juegos de prueba en el catalogo.
 *
 * Es una herramienta de carga de datos, no parte de la API publica: exige la
 * cabecera `x-admin-secret` y devuelve un resumen de lo sincronizado.
 */
@ApiTags('admin')
@Controller('admin/sync')
export class AdminSyncController {
  constructor(
    private readonly syncService: SyncRandomGamesService,
    private readonly config: ConfigService,
  ) {}

  @Post('random')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sincroniza juegos de prueba de Steam y/o Nintendo Switch',
    description:
      'Trae juegos aleatorios de las APIs publicas de las tiendas, crea el ' +
      'juego y su oferta en el catalogo y genera 30 dias de historico de ' +
      'precios. Es idempotente: repetir la llamada no duplica nada.',
  })
  @ApiHeader({
    name: 'x-admin-secret',
    required: true,
    description: 'Secreto de administracion (ADMIN_SYNC_SECRET).',
  })
  @ApiOkResponse({
    description: 'Resumen de la sincronizacion.',
    schema: {
      type: 'object',
      properties: {
        requested: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            platforms: { type: 'array', items: { type: 'string' } },
          },
        },
        games: { type: 'number' },
        offers: { type: 'number' },
        history: { type: 'number' },
        durationMs: { type: 'number' },
        sources: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
  })
  async syncRandomGames(
    @Headers('x-admin-secret') adminSecret: string | undefined,
    @Query() query: SyncRandomGamesDto,
  ): Promise<SyncRandomGamesResult> {
    this.assertAuthorized(adminSecret);

    const configuredCount = this.config.get<number>('adminSync.count') ?? 10;
    const configuredPlatforms =
      this.config.get<string>('adminSync.platforms') ?? 'steam,nintendo';

    const count = query.count ?? configuredCount;
    const platforms = parseSyncPlatforms(
      query.platforms ?? configuredPlatforms,
    );

    const result = await this.syncService.run({
      count,
      platforms,
      ...(query.seed !== undefined ? { seed: query.seed } : {}),
      ...(query.onlyNew !== undefined ? { onlyNew: query.onlyNew } : {}),
    });

    const failed = Object.entries(result.sources)
      .filter(([, source]) => source === 'error')
      .map(([platform]) => platform);
    if (failed.length > 0) {
      throw new InternalServerErrorException(
        `Sincronizacion fallida para ${failed.join(', ')} tras ${result.offers} ofertas sincronizadas`,
      );
    }

    return result;
  }

  /**
   * Comprueba la cabecera `x-admin-secret`. Sin secreto configurado el
   * endpoint queda cerrado (403), y con secreto incorrecto tambien (403).
   */
  private assertAuthorized(adminSecret: string | undefined): void {
    const expected = this.config.get<string>('adminSync.secret') ?? '';
    if (!expected) {
      throw new ForbiddenException(
        'Sincronizacion deshabilitada: ADMIN_SYNC_SECRET no esta configurado',
      );
    }
    if (!adminSecret || adminSecret !== expected) {
      throw new ForbiddenException('Secreto de administracion invalido');
    }
  }
}
