import type { Static } from '@sinclair/typebox';
import { Repository } from 'typeorm';
import { Franchise } from './entities/franchise.entity.js';
import { FranchisePlayOrder } from './entities/franchise-play-order.entity.js';
import { NotFoundException } from '../errors.js';
import { FranchiseRoute, FranchiseSummary } from '../schemas/franchises.js';
import { RouteEntry } from '../schemas/games.js';

export class FranchisesService {
  constructor(
    private readonly franchiseRepo: Repository<Franchise>,
    private readonly playOrderRepo: Repository<FranchisePlayOrder>,
  ) {}

  /**
   * Listado de sagas con el numero de juegos de cada una. Resuelve el
   * recuento con una unica consulta agregada sobre `franchise_play_order`.
   */
  async findAll(): Promise<Static<typeof FranchiseSummary>[]> {
    const rows = await this.playOrderRepo
      .createQueryBuilder('fpo')
      .innerJoin('fpo.franchise', 'franchise')
      .select([
        'franchise.slug AS "slug"',
        'franchise.name AS "name"',
        'franchise.description AS "description"',
        'COUNT(fpo.id) AS "gameCount"',
      ])
      .groupBy('franchise.id')
      .orderBy('franchise.name', 'ASC')
      .getRawMany<{
        slug: string;
        name: string;
        description: string | null;
        gameCount: string;
      }>();

    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description,
      gameCount: Number(row.gameCount),
    }));
  }

  /**
   * Ruta de juego de una saga, ordenada por posicion y con los juegos
   * resueltos. Devuelve 404 si la saga no existe.
   */
  async findRouteBySlug(slug: string): Promise<Static<typeof FranchiseRoute>> {
    const franchise = await this.franchiseRepo.findOne({ where: { slug } });
    if (!franchise) {
      throw new NotFoundException(`No existe la saga con slug "${slug}"`);
    }
    return this.buildRoute(franchise);
  }

  /**
   * Ruta de la saga a la que pertenece un juego. Si el juego no esta en
   * ninguna saga devuelve null.
   */
  async findRouteForGame(
    gameId: string,
  ): Promise<Static<typeof FranchiseRoute> | null> {
    const entry = await this.playOrderRepo.findOne({
      where: { gameId },
      relations: { franchise: true },
    });
    if (!entry?.franchise) {
      return null;
    }
    return this.buildRoute(entry.franchise);
  }

  /**
   * Construye la ruta de una saga con un unico JOIN sobre
   * `franchise_play_order` y `games`.
   */
  private async buildRoute(
    franchise: Franchise,
  ): Promise<Static<typeof FranchiseRoute>> {
    const rows = await this.playOrderRepo
      .createQueryBuilder('fpo')
      .innerJoin('fpo.game', 'game')
      .select([
        'fpo.position AS "position"',
        'fpo.note AS "note"',
        'game.slug AS "gameSlug"',
        'game.title AS "gameTitle"',
        'game.coverUrl AS "gameCoverUrl"',
        'game.release_date::text AS "gameReleaseDate"',
        'game.qualityScore AS "gameQualityScore"',
      ])
      .where('fpo.franchiseId = :franchiseId', { franchiseId: franchise.id })
      .orderBy('fpo.position', 'ASC')
      .getRawMany<{
        position: number;
        note: string | null;
        gameSlug: string;
        gameTitle: string;
        gameCoverUrl: string | null;
        gameReleaseDate: string | null;
        gameQualityScore: number;
      }>();

    const route: Static<typeof RouteEntry>[] = rows.map((row) => ({
      position: Number(row.position),
      note: row.note,
      game: {
        slug: row.gameSlug,
        title: row.gameTitle,
        coverUrl: row.gameCoverUrl,
        releaseDate: row.gameReleaseDate,
        qualityScore: Number(row.gameQualityScore),
      },
    }));

    return {
      name: franchise.name,
      slug: franchise.slug,
      description: franchise.description,
      route,
    };
  }
}
