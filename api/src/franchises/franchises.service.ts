import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Franchise } from './entities/franchise.entity.js';
import { FranchisePlayOrder } from './entities/franchise-play-order.entity.js';
import { FranchiseRouteDto, RouteEntryDto } from './dto/franchise-route.dto.js';

@Injectable()
export class FranchisesService {
  constructor(
    @InjectRepository(Franchise)
    private readonly franchiseRepo: Repository<Franchise>,
    @InjectRepository(FranchisePlayOrder)
    private readonly playOrderRepo: Repository<FranchisePlayOrder>,
  ) {}

  /**
   * Ruta de juego de una saga, ordenada por posicion y con los juegos
   * resueltos. Devuelve 404 si la saga no existe.
   */
  async findRouteBySlug(slug: string): Promise<FranchiseRouteDto> {
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
  async findRouteForGame(gameId: string): Promise<FranchiseRouteDto | null> {
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
  private async buildRoute(franchise: Franchise): Promise<FranchiseRouteDto> {
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

    const route: RouteEntryDto[] = rows.map((row) => ({
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
