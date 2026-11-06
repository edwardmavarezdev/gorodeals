import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../games/entities/game.entity.js';
import { IgdbGameDto, IgdbSyncResultDto } from './dto/igdb-game.dto.js';
import { IgdbSyncDto } from './dto/igdb-sync.dto.js';
import { IgdbClient } from './igdb.client.js';
import { IgdbBadQueryError } from './igdb.errors.js';
import {
  IGDB_GAME_FIELDS,
  isValidRawGame,
  mapRawGameToDto,
  normalizeSlug,
} from './mappers/igdb.mapper.js';

@Injectable()
export class IgdbService {
  private readonly logger = new Logger(IgdbService.name);

  constructor(
    private readonly client: IgdbClient,
    @InjectRepository(Game)
    private readonly gamesRepository: Repository<Game>,
  ) {}

  /** Indica si las credenciales de IGDB estan configuradas. */
  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  /**
   * Busca juegos por nombre en IGDB y devuelve metadatos normalizados.
   */
  async searchByName(term: string, limit = 20): Promise<IgdbGameDto[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const query = [
      `fields ${IGDB_GAME_FIELDS};`,
      `search "${this.escapeApicalypse(term)}";`,
      `limit ${safeLimit};`,
    ].join(' ');

    const raw = await this.client.query(query);
    return raw.filter(isValidRawGame).map((game) => mapRawGameToDto(game));
  }

  /**
   * Obtiene los metadatos de un juego por su ID de IGDB.
   */
  async findByIgdbId(igdbId: string | number): Promise<IgdbGameDto | null> {
    const numericId = Number(igdbId);
    if (!Number.isFinite(numericId)) {
      throw new IgdbBadQueryError(`El ID de IGDB "${igdbId}" no es valido`);
    }

    const query = `fields ${IGDB_GAME_FIELDS}; id = ${Math.trunc(numericId)};`;
    const raw = await this.client.query(query);
    const game = raw.find(isValidRawGame);
    return game ? mapRawGameToDto(game) : null;
  }

  /**
   * Sincroniza un lote de juegos de IGDB contra la tabla `games`.
   * La operacion es idempotente: se hace upsert por `igdb_id`.
   */
  async sync(dto: IgdbSyncDto): Promise<IgdbSyncResultDto> {
    const limit = Math.min(Math.max(dto.limit ?? 50, 1), 50);
    const offset = Math.max(dto.offset ?? 0, 0);

    const query =
      dto.query ??
      [
        `fields ${IGDB_GAME_FIELDS};`,
        `limit ${limit};`,
        `offset ${offset};`,
        'sort name asc;',
      ].join(' ');

    const raw = await this.client.query(query);
    const valid = raw.filter(isValidRawGame);

    let upserted = 0;
    let skipped = 0;

    for (const item of valid) {
      const mapped = mapRawGameToDto(item);
      const persisted = await this.upsertGame(mapped);
      if (persisted) {
        upserted += 1;
      } else {
        skipped += 1;
      }
    }

    this.logger.log(
      `Sincronizacion IGDB completada: ${upserted} upsert, ${skipped} omitidos`,
    );

    return {
      fetched: raw.length,
      upserted,
      skipped: raw.length - valid.length + skipped,
    };
  }

  /**
   * Inserta o actualiza un juego por `igdb_id` usando ON CONFLICT.
   * Devuelve false si no se pudo persistir por datos invalidos.
   */
  private async upsertGame(dto: IgdbGameDto): Promise<boolean> {
    const slug = await this.resolveUniqueSlug(dto.slug, dto.igdbId);

    await this.gamesRepository.upsert(
      {
        igdbId: dto.igdbId,
        title: dto.title,
        slug,
        summary: dto.summary ?? null,
        description: dto.description ?? null,
        coverUrl: dto.coverUrl ?? null,
        screenshots: dto.screenshots,
        genres: dto.genres,
        platforms: dto.platforms,
        releaseDate: dto.releaseDate ?? null,
        // La columna `metacritic_score` es smallint (0-100) y guarda la
        // puntuacion de criticos que publica IGDB (`aggregated_rating`).
        metacriticScore:
          dto.criticsScore === null || dto.criticsScore === undefined
            ? null
            : Math.round(dto.criticsScore),
      },
      {
        conflictPaths: ['igdbId'],
        skipUpdateIfNoValuesChanged: false,
      },
    );

    return true;
  }

  /**
   * Escapa el texto de busqueda para insertarlo en una cadena de Apicalypse.
   *
   * El caracter de escape de Apicalypse es la barra invertida, asi que se
   * escapa PRIMERO la barra y despues la comilla. Si solo se escapase la
   * comilla, un termino terminado en barra dejaria la comilla de cierre
   * escapada y el resto del texto del usuario pasaria a formar parte de la
   * query (podiendo forzar `limit`, `sort` o `fields`).
   */
  private escapeApicalypse(term: string): string {
    return term.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  /**
   * Garantiza que el slug sea unico en la base. IGDB puede devolver slugs
   * repetidos entre versiones distintas de un mismo juego.
   */
  private async resolveUniqueSlug(
    baseSlug: string,
    igdbId: string,
  ): Promise<string> {
    const root = normalizeSlug(baseSlug) || 'juego';
    let candidate = root;

    for (let suffix = 2; suffix < 100; suffix += 1) {
      const existing = await this.gamesRepository.findOne({
        where: { slug: candidate },
        select: { igdbId: true },
      });
      if (!existing || existing.igdbId === igdbId) {
        return candidate;
      }
      candidate = `${root}-${suffix}`;
    }

    // Colision persistente: se desambigua con el ID de IGDB.
    return `${root}-${igdbId}`;
  }
}
