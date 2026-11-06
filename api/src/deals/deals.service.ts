import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DealScoreService } from './deal-score.service.js';
import { HottestDealsResponseDto } from './dto/hottest-deals-response.dto.js';
import { CatalogItemDto } from '../games/dto/catalog-item.dto.js';

/**
 * Oferta candidata del top, con los datos del juego resuelto en la misma
 * consulta (JOIN, sin N+1).
 */
interface DealRow {
  store_name: string;
  store_product_id: string;
  current_price: number;
  regular_price: number;
  discount_percent: number;
  currency: string;
  url: string | null;
  deal_score: number | null;
  historical_low_price: number | null;
  game_id: string;
  slug: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  genres: string[];
  platforms: string[];
  release_date: string | null;
  metacritic_score: number | null;
  quality_score: number;
}

/** Numero maximo de candidatos leidos antes de ordenar en memoria. */
const MAX_CANDIDATES = 200;

@Injectable()
export class DealsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly dealScoreService: DealScoreService,
  ) {}

  /**
   * Top de ofertas por Deal Score. Solo se consideran ofertas disponibles con
   * descuento. Cuando `deal_score` no esta persistido, el score se calcula
   * en memoria (no se persiste en esta fase) y se usa para ordenar.
   */
  async hottest(limit: number = 20): Promise<HottestDealsResponseDto> {
    const candidates = Math.min(limit * 5, MAX_CANDIDATES);

    const rows = await this.dataSource.query<DealRow[]>(
      `
        SELECT
          sp.store_name,
          sp.store_product_id,
          sp.current_price,
          sp.regular_price,
          sp.discount_percent,
          sp.currency,
          sp.url,
          sp.deal_score,
          sp.historical_low_price,
          g.id AS game_id,
          g.slug,
          g.title,
          g.summary,
          g.cover_url,
          g.genres,
          g.platforms,
          g.release_date::text AS release_date,
          g.metacritic_score,
          g.quality_score
        FROM store_products sp
        INNER JOIN games g ON g.id = sp.game_id
        WHERE sp.is_available = true AND sp.discount_percent > 0
        ORDER BY sp.deal_score DESC NULLS LAST, sp.discount_percent DESC
        LIMIT $1
      `,
      [candidates],
    );

    const items: CatalogItemDto[] = rows
      .map((row) => this.toCatalogItem(row))
      .sort((a, b) => {
        const scoreA = a.bestOffer?.dealScore ?? 0;
        const scoreB = b.bestOffer?.dealScore ?? 0;
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        return (
          (b.bestOffer?.discountPercent ?? 0) -
          (a.bestOffer?.discountPercent ?? 0)
        );
      })
      .slice(0, limit);

    return { items };
  }

  /**
   * Convierte una fila del top en el formato de item del catalogo, con la
   * oferta como `bestOffer` y el Deal Score efectivo.
   */
  private toCatalogItem(row: DealRow): CatalogItemDto {
    const qualityScore = Number(row.quality_score);
    const currentPrice = Number(row.current_price);
    const discountPercent = Number(row.discount_percent);
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
      id: row.game_id,
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
      bestOffer: {
        storeName: row.store_name,
        storeProductId: row.store_product_id,
        currentPrice,
        regularPrice: Number(row.regular_price),
        discountPercent,
        currency: row.currency,
        url: row.url,
        dealScore,
      },
    };
  }
}
