import type { Static } from '@sinclair/typebox';
import { Repository } from 'typeorm';
import { PriceHistory } from './entities/price-history.entity.js';
import { StoreProduct } from '../store-products/entities/store-product.entity.js';
import { NotFoundException } from '../errors.js';
import { PriceHistoryPoint } from '../schemas/games.js';
import { PriceHistoryResponse, PriceSeriesPoint } from '../schemas/prices.js';

/** Meses de historico por defecto en la ficha de un juego (90 dias). */
export const DEFAULT_GAME_HISTORY_MONTHS = 3;

/** Meses de historico por defecto en la serie de precios. */
export const DEFAULT_SERIES_MONTHS = 12;

export class PricesService {
  constructor(
    private readonly priceHistoryRepo: Repository<PriceHistory>,
    private readonly storeProductRepo: Repository<StoreProduct>,
  ) {}

  /**
   * Fecha de corte del historico: `months` meses atras desde ahora.
   */
  private since(months: number): Date {
    const date = new Date();
    date.setUTCMonth(date.getUTCMonth() - months);
    return date;
  }

  /**
   * Historico de precios de todas las ofertas de un juego, en orden
   * cronologico. Se resuelve con un unico JOIN: una consulta por juego,
   * nunca una por oferta.
   */
  async findHistoryForGame(
    gameId: string,
    months: number = DEFAULT_GAME_HISTORY_MONTHS,
  ): Promise<Static<typeof PriceHistoryPoint>[]> {
    const rows = await this.priceHistoryRepo
      .createQueryBuilder('ph')
      .innerJoin(StoreProduct, 'sp', 'sp.id = ph.storeProductId')
      .select([
        'ph.storeProductId AS "storeProductId"',
        'sp.storeName AS "storeName"',
        'ph.price AS "price"',
        'ph.regularPrice AS "regularPrice"',
        'ph.discountPercent AS "discountPercent"',
        'ph.recordedAt AS "recordedAt"',
      ])
      .where('sp.gameId = :gameId', { gameId })
      .andWhere('ph.recordedAt >= :since', { since: this.since(months) })
      .orderBy('ph.recordedAt', 'ASC')
      .getRawMany<{
        storeProductId: string;
        storeName: string;
        price: number;
        regularPrice: number | null;
        discountPercent: number | null;
        recordedAt: Date;
      }>();

    return rows.map((row) => ({
      storeProductId: row.storeProductId,
      storeName: row.storeName,
      price: Number(row.price),
      regularPrice: row.regularPrice === null ? null : Number(row.regularPrice),
      discountPercent:
        row.discountPercent === null ? null : Number(row.discountPercent),
      recordedAt: new Date(row.recordedAt).toISOString(),
    }));
  }

  /**
   * Serie de precios de una oferta concreta. Si no se indica oferta, se usa
   * la mejor del juego (mayor descuento y, a igualdad, menor precio).
   */
  async findSeriesForGame(
    gameId: string,
    months: number = DEFAULT_SERIES_MONTHS,
    storeProductId?: string,
  ): Promise<Static<typeof PriceHistoryResponse>> {
    const product = await this.resolveStoreProduct(gameId, storeProductId);

    const rows = await this.priceHistoryRepo
      .createQueryBuilder('ph')
      .select([
        'ph.recordedAt AS "recordedAt"',
        'ph.price AS "price"',
        'ph.regularPrice AS "regularPrice"',
        'ph.discountPercent AS "discountPercent"',
      ])
      .where('ph.storeProductId = :storeProductId', {
        storeProductId: product.id,
      })
      .andWhere('ph.recordedAt >= :since', { since: this.since(months) })
      .orderBy('ph.recordedAt', 'ASC')
      .getRawMany<{
        recordedAt: Date;
        price: number;
        regularPrice: number | null;
        discountPercent: number | null;
      }>();

    const points: Static<typeof PriceSeriesPoint>[] = rows.map((row) => ({
      recordedAt: new Date(row.recordedAt).toISOString(),
      price: Number(row.price),
      regularPrice: row.regularPrice === null ? null : Number(row.regularPrice),
      discountPercent:
        row.discountPercent === null ? null : Number(row.discountPercent),
    }));

    return { storeProductId: product.id, points };
  }

  /**
   * Resuelve la oferta de la que se pide la serie. Acepta tanto el UUID de
   * `store_products` como el id de producto de la tienda (appid de Steam).
   * Valida que la oferta pertenezca al juego; si no se indica ninguna, elige
   * la mejor oferta vigente del juego.
   */
  private async resolveStoreProduct(
    gameId: string,
    storeProductId?: string,
  ): Promise<StoreProduct> {
    if (storeProductId) {
      const product = await this.storeProductRepo
        .createQueryBuilder('sp')
        .where('sp.gameId = :gameId', { gameId })
        .andWhere('(sp.id::text = :ref OR sp.storeProductId = :ref)', {
          ref: storeProductId,
        })
        .getOne();
      if (!product) {
        throw new NotFoundException(
          `La oferta ${storeProductId} no pertenece al juego ${gameId}`,
        );
      }
      return product;
    }

    const product = await this.storeProductRepo
      .createQueryBuilder('sp')
      .where('sp.gameId = :gameId', { gameId })
      .orderBy('sp.discountPercent', 'DESC')
      .addOrderBy('sp.currentPrice', 'ASC')
      .addOrderBy('sp.id', 'ASC')
      .getOne();

    if (!product) {
      throw new NotFoundException(
        `El juego ${gameId} no tiene ofertas de precio registradas`,
      );
    }
    return product;
  }
}
