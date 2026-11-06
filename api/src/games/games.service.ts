import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Game } from './entities/game.entity.js';
import { StoreProduct } from '../store-products/entities/store-product.entity.js';
import {
  PricesService,
  DEFAULT_GAME_HISTORY_MONTHS,
} from '../prices/prices.service.js';
import { FranchisesService } from '../franchises/franchises.service.js';
import { DealScoreService } from '../deals/deal-score.service.js';
import { CatalogQueryDto } from './dto/catalog-query.dto.js';
import { CatalogResponseDto } from './dto/catalog-response.dto.js';
import { CatalogItemDto } from './dto/catalog-item.dto.js';
import { BestOfferDto } from './dto/best-offer.dto.js';
import { GameDetailDto } from './dto/game-detail.dto.js';
import { GameDetailResponseDto } from './dto/game-detail-response.dto.js';
import { OfferDto } from './dto/offer.dto.js';

/**
 * Fila cruda del catalogo con la mejor oferta resuelta en SQL (LATERAL).
 */
interface CatalogRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  genres: string[];
  platforms: string[];
  release_date: string | null;
  metacritic_score: number | null;
  quality_score: number;
  store_name: string | null;
  store_product_id: string | null;
  current_price: number | null;
  regular_price: number | null;
  discount_percent: number | null;
  currency: string | null;
  url: string | null;
  deal_score: number | null;
  historical_low_price: number | null;
}

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepo: Repository<Game>,
    @InjectRepository(StoreProduct)
    private readonly storeProductRepo: Repository<StoreProduct>,
    private readonly pricesService: PricesService,
    private readonly franchisesService: FranchisesService,
    private readonly dealScoreService: DealScoreService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Pagina del catalogo. La paginacion y el filtro se resuelven en SQL
   * (LIMIT/OFFSET) y la mejor oferta de cada juego se resuelve con un unico
   * LATERAL JOIN: nunca hay una consulta por juego.
   */
  async listCatalog(query: CatalogQueryDto): Promise<CatalogResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const offset = (page - 1) * limit;

    const filters: string[] = [];
    const params: unknown[] = [];

    if (query.q) {
      params.push(`%${query.q}%`);
      filters.push(`g.title ILIKE $${params.length}`);
    }

    if (query.store) {
      params.push(query.store);
      filters.push(
        `EXISTS (SELECT 1 FROM store_products sp_filter
                  WHERE sp_filter.game_id = g.id AND sp_filter.store_name = $${params.length})`,
      );
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const lateralStore = query.store
      ? `AND sp.store_name = $${params.length}`
      : '';

    const orderBy =
      query.sort === 'quality'
        ? 'g.quality_score DESC, g.id'
        : query.sort === 'discount'
          ? 'COALESCE(o.discount_percent, 0) DESC, g.id'
          : 'g.release_date DESC NULLS LAST, g.id';

    const rows = await this.dataSource.query<CatalogRow[]>(
      `
        SELECT
          g.id,
          g.slug,
          g.title,
          g.summary,
          g.cover_url,
          g.genres,
          g.platforms,
          g.release_date::text AS release_date,
          g.metacritic_score,
          g.quality_score,
          o.store_name,
          o.store_product_id,
          o.current_price,
          o.regular_price,
          o.discount_percent,
          o.currency,
          o.url,
          o.deal_score,
          o.historical_low_price
        FROM games g
        LEFT JOIN LATERAL (
          SELECT
            sp.store_name,
            sp.store_product_id,
            sp.current_price,
            sp.regular_price,
            sp.discount_percent,
            sp.currency,
            sp.url,
            sp.deal_score,
            sp.historical_low_price
          FROM store_products sp
          WHERE sp.game_id = g.id
          ${lateralStore}
          ORDER BY
            sp.discount_percent DESC,
            sp.current_price ASC,
            sp.deal_score DESC NULLS LAST,
            sp.id
          LIMIT 1
        ) o ON TRUE
        ${where}
        ORDER BY ${orderBy}
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    const countRows = await this.dataSource.query<{ total: number }[]>(
      `SELECT count(*)::int AS total FROM games g ${where}`,
      params,
    );

    const total = countRows[0]?.total ?? 0;

    const items: CatalogItemDto[] = rows.map((row) => {
      const qualityScore = Number(row.quality_score);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        coverUrl: row.cover_url,
        genres: row.genres ?? [],
        platforms: row.platforms ?? [],
        releaseDate: row.release_date,
        metacriticScore:
          row.metacritic_score === null ? null : Number(row.metacritic_score),
        qualityScore,
        bestOffer: this.mapBestOffer(row, qualityScore),
      };
    });

    return { page, limit, total, items };
  }

  /**
   * Mapea la mejor oferta de una fila del catalogo. Si la oferta no tiene
   * `deal_score` persistido, el score se calcula en memoria.
   */
  private mapBestOffer(
    row: CatalogRow,
    qualityScore: number,
  ): BestOfferDto | null {
    if (!row.store_name || row.store_product_id === null) {
      return null;
    }
    const currentPrice = Number(row.current_price ?? 0);
    const discountPercent = Number(row.discount_percent ?? 0);
    const historicalLowPrice =
      row.historical_low_price === null
        ? null
        : Number(row.historical_low_price);

    const dealScore =
      row.deal_score === null
        ? this.dealScoreService.compute({
            qualityScore,
            discountPercent,
            currentPrice,
            historicalLowPrice,
          })
        : Number(row.deal_score);

    return {
      storeName: row.store_name,
      storeProductId: row.store_product_id,
      currentPrice,
      regularPrice: Number(row.regular_price ?? 0),
      discountPercent,
      currency: row.currency ?? 'USD',
      url: row.url,
      dealScore,
    };
  }

  /**
   * Ficha completa de un juego: metadatos, ofertas, historico y saga.
   */
  async findBySlug(
    slug: string,
    months: number = DEFAULT_GAME_HISTORY_MONTHS,
  ): Promise<GameDetailResponseDto> {
    const game = await this.gameRepo.findOne({ where: { slug } });
    if (!game) {
      throw new NotFoundException(`No existe el juego con slug "${slug}"`);
    }

    const offers = await this.storeProductRepo.find({
      where: { gameId: game.id },
      order: { discountPercent: 'DESC', currentPrice: 'ASC' },
    });

    const priceHistory = await this.pricesService.findHistoryForGame(
      game.id,
      months,
    );
    const franchise = await this.franchisesService.findRouteForGame(game.id);

    const detail: GameDetailDto = {
      id: game.id,
      slug: game.slug,
      title: game.title,
      summary: game.summary,
      description: game.description,
      coverUrl: game.coverUrl,
      screenshots: game.screenshots,
      genres: game.genres,
      platforms: game.platforms,
      releaseDate: game.releaseDate,
      metacriticScore: game.metacriticScore,
      qualityScore: Number(game.qualityScore),
    };

    const offerDtos: OfferDto[] = offers.map((offer) => ({
      storeName: offer.storeName,
      storeProductId: offer.storeProductId,
      currentPrice: Number(offer.currentPrice),
      regularPrice: Number(offer.regularPrice),
      discountPercent: Number(offer.discountPercent),
      currency: offer.currency,
      url: offer.url,
      isAvailable: offer.isAvailable,
      historicalLowPrice:
        offer.historicalLowPrice === null
          ? null
          : Number(offer.historicalLowPrice),
      dealScore:
        offer.dealScore === null
          ? this.dealScoreService.compute({
              qualityScore: Number(game.qualityScore),
              discountPercent: Number(offer.discountPercent),
              currentPrice: Number(offer.currentPrice),
              historicalLowPrice:
                offer.historicalLowPrice === null
                  ? null
                  : Number(offer.historicalLowPrice),
            })
          : Number(offer.dealScore),
      lastCheckedAt: new Date(offer.lastCheckedAt).toISOString(),
    }));

    return { game: detail, offers: offerDtos, priceHistory, franchise };
  }
}
