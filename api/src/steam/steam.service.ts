import type { Static } from '@sinclair/typebox';
import { Repository } from 'typeorm';
import { SteamClient } from './steam.client.js';
import { SteamAppDetails } from './steam.types.js';
import {
  StoreName,
  StoreProduct,
} from '../store-products/entities/store-product.entity.js';
import { Game } from '../games/entities/game.entity.js';
import {
  SteamAppNotFoundError,
  SteamPriceUnavailableError,
  SteamStoreProductConflictError,
} from './steam.errors.js';
import type { AppConfig } from '../config.js';
import { NotFoundException } from '../errors.js';
import { createLogger } from '../logger.js';
import {
  SteamPriceSnapshot,
  SteamSyncItem,
  SteamSyncSummary,
} from '../schemas/steam.js';

/** Divisor de los importes publicados por Steam (centavos). */
const CENTS = 100;

/**
 * Resultado de persistir un appid de Steam.
 *
 * Tipo derivado del esquema `SteamSyncItem`: es el contrato de la respuesta
 * de `POST /steam/sync`.
 */
export type SteamSyncItemResult = Static<typeof SteamSyncItem>;

/**
 * Servicio de Steam: normaliza la respuesta de la tienda y persiste las
 * ofertas en `store_products` de forma idempotente.
 *
 * El alta de una oferta exige el `game_id` (FK a `games`). Cada juego declara
 * su appid de Steam en la peticion de sync; el binding juego <-> appid es
 * responsabilidad de quien sincroniza (IGDB o el catalogo), este modulo solo
 * garantiza que el precio llegue a la fila correcta sin duplicarla.
 */
export class SteamService {
  private readonly logger = createLogger('SteamService');

  constructor(
    private readonly client: SteamClient,
    private readonly storeProducts: Repository<StoreProduct>,
    private readonly games: Repository<Game>,
    private readonly config: AppConfig,
  ) {}

  /** Verifica que el juego exista: `store_products.game_id` es FK obligatoria. */
  private async assertGameExists(gameId: string): Promise<void> {
    const exists = await this.games.exists({ where: { id: gameId } });
    if (!exists) {
      throw new NotFoundException(`No existe el juego ${gameId}`);
    }
  }

  /**
   * Normaliza el detalle crudo de Steam a un snapshot de precio.
   * `price_overview` puede no existir (juego gratis, region sin IAP o app sin
   * precio publicado): en ese caso el precio es 0 y no se lanza excepcion.
   */
  toPriceSnapshot(
    appId: number,
    details: SteamAppDetails,
  ): Static<typeof SteamPriceSnapshot> {
    const price = details.price_overview;
    const isFree = details.is_free === true;

    const currentPrice = this.toMajorUnits(price?.final ?? 0);
    const regularPrice = this.toMajorUnits(
      price?.initial ?? price?.final ?? currentPrice,
    );

    let discountPercent = price?.discount_percent ?? 0;
    if (
      !price?.discount_percent &&
      regularPrice > 0 &&
      currentPrice < regularPrice
    ) {
      discountPercent = Number(
        (((regularPrice - currentPrice) / regularPrice) * 100).toFixed(2),
      );
    }
    // El CHECK de la base de datos exige 0 <= discount_percent <= 100. Un
    // valor fuera de rango (o NaN) abortaba la transaccion del lote entero.
    discountPercent = this.clampDiscountPercent(discountPercent);

    const recommendations = details.recommendations;
    const totalVotes = recommendations?.total ?? 0;
    const positiveVotes = recommendations?.total_positive;
    // Steam no siempre publica `total_positive` (depende del juego y de la
    // region). Sin ese dato la valoracion es desconocida, no cero.
    const ratingPercent =
      positiveVotes !== undefined && totalVotes > 0
        ? Number(((positiveVotes / totalVotes) * 100).toFixed(2))
        : null;

    return {
      appId,
      name: details.name ?? null,
      currency: this.resolveCurrency(price?.currency),
      currentPrice,
      regularPrice,
      discountPercent,
      isFree,
      isAvailable: true,
      url: this.client.buildStoreUrl(appId),
      ratingPercent,
      ratingVotes: totalVotes > 0 ? totalVotes : null,
      metacriticScore: details.metacritic?.score ?? null,
      // Steam no publica el tamano de descarga en appdetails; se documenta
      // como limitacion hasta disponer de una fuente fiable.
      downloadSizeMb: null,
      releaseDate: details.release_date?.date ?? null,
      developers: details.developers ?? [],
      publishers: details.publishers ?? [],
      genres: (details.genres ?? []).map((genre) => genre.description),
      platforms: Object.entries(details.platforms ?? {})
        .filter(([, enabled]) => enabled === true)
        .map(([platform]) => platform),
      headerImage: details.header_image ?? null,
    };
  }

  /** Snapshot de precio de un appid, sin persistir. */
  async getPriceSnapshot(
    appId: number,
  ): Promise<Static<typeof SteamPriceSnapshot> | null> {
    const details = await this.client.fetchAppDetails(appId);
    if (!details) {
      return null;
    }
    return this.toPriceSnapshot(appId, details);
  }

  /**
   * Snapshot de precio exigiendo que el juego tenga precio publicado.
   * Lanza `SteamAppNotFoundError` si el appid no existe y
   * `SteamPriceUnavailableError` si existe pero no tiene precio en la region
   * configurada (por ejemplo, un DLC o una app no comprable en `us`).
   */
  async getPricedSnapshot(
    appId: number,
  ): Promise<Static<typeof SteamPriceSnapshot>> {
    const details = await this.client.fetchAppDetails(appId);
    if (!details) {
      throw new SteamAppNotFoundError(appId);
    }
    if (details.price_overview === undefined && details.is_free !== true) {
      throw new SteamPriceUnavailableError(appId);
    }
    return this.toPriceSnapshot(appId, details);
  }

  /** Snapshots de precio de varios appids, sin persistir. */
  async getPriceSnapshots(
    appIds: number[],
  ): Promise<Map<number, Static<typeof SteamPriceSnapshot>>> {
    const details = await this.client.fetchAppDetailsBatch(appIds);
    const snapshots = new Map<number, Static<typeof SteamPriceSnapshot>>();
    for (const [appId, appDetails] of details) {
      snapshots.set(appId, this.toPriceSnapshot(appId, appDetails));
    }
    return snapshots;
  }

  /**
   * Contrato con el modulo de sincronizacion de precios (Fase 3.3): dado un
   * producto persistido, devuelve el precio actual que Steam publica ahora.
   * Devuelve `null` si Steam no tiene datos para ese appid.
   */
  async getCurrentPrice(
    storeProduct: Pick<StoreProduct, 'storeName' | 'storeProductId'>,
  ): Promise<Static<typeof SteamPriceSnapshot> | null> {
    if (storeProduct.storeName !== StoreName.STEAM) {
      return null;
    }
    const appId = Number(storeProduct.storeProductId);
    if (!Number.isInteger(appId) || appId <= 0) {
      return null;
    }
    return this.getPriceSnapshot(appId);
  }

  /**
   * Sincroniza una lista de appids para un juego. Es idempotente: el upsert
   * usa ON CONFLICT sobre (store_name, store_product_id), de modo que repetir
   * la llamada nunca duplica filas ni historial.
   */
  async syncGame(
    gameId: string,
    appIds: number[],
  ): Promise<Static<typeof SteamSyncSummary>> {
    await this.assertGameExists(gameId);
    const items: SteamSyncItemResult[] = [];
    const snapshots = await this.client.fetchAppDetailsBatch(appIds);

    for (const appId of appIds) {
      const details = snapshots.get(appId);
      if (!details) {
        items.push({
          appId,
          status: 'not_found',
          message: 'Steam no publica datos para este appid',
        });
        continue;
      }
      try {
        const snapshot = this.toPriceSnapshot(appId, details);
        const storeProduct = await this.upsertStoreProduct(gameId, snapshot);
        items.push({
          appId,
          status: 'upserted',
          storeProductId: storeProduct.id,
          gameId: storeProduct.gameId,
          currentPrice: snapshot.currentPrice,
          regularPrice: snapshot.regularPrice,
          discountPercent: snapshot.discountPercent,
          currency: snapshot.currency,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'error de persistencia';
        this.logger.error(`Fallo al persistir el appid ${appId}: ${message}`);
        items.push({ appId, status: 'error', message });
      }
    }

    return {
      requested: appIds.length,
      upserted: items.filter((item) => item.status === 'upserted').length,
      notFound: items.filter((item) => item.status === 'not_found').length,
      errors: items.filter((item) => item.status === 'error').length,
      items,
    };
  }

  /** Fila persistida de la oferta Steam, si existe. */
  async findStoreProductByAppId(appId: number): Promise<StoreProduct | null> {
    return this.storeProducts.findOne({
      where: {
        storeName: StoreName.STEAM,
        storeProductId: String(appId),
      },
    });
  }

  /** Fila persistida de la oferta Steam; lanza 404 si no existe. */
  async getStoreProductOrFail(appId: number): Promise<StoreProduct> {
    const product = await this.findStoreProductByAppId(appId);
    if (!product) {
      throw new NotFoundException(
        `No existe oferta de Steam para el appid ${appId}`,
      );
    }
    return product;
  }

  /**
   * Upsert idempotente sobre (store_name, store_product_id).
   *
   * El `game_id` no se reescribe en el conflicto: un appid de Steam pertenece
   * a un unico juego en el catalogo y la fila existente ya esta vinculada.
   */
  private async upsertStoreProduct(
    gameId: string,
    snapshot: Static<typeof SteamPriceSnapshot>,
  ): Promise<StoreProduct> {
    const storeProductId = String(snapshot.appId);

    // Upsert idempotente con ON CONFLICT sobre (store_name, store_product_id).
    // Se usa SQL explicito porque `orUpdate` de TypeORM no mapea los nombres
    // de columna en el conflicto.
    try {
      await this.storeProducts.query(
        `
        INSERT INTO store_products (
          game_id,
          store_name,
          store_product_id,
          current_price,
          regular_price,
          discount_percent,
          currency,
          url,
          is_available,
          last_checked_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (store_name, store_product_id) DO UPDATE SET
          current_price = EXCLUDED.current_price,
          regular_price = EXCLUDED.regular_price,
          discount_percent = EXCLUDED.discount_percent,
          currency = EXCLUDED.currency,
          url = EXCLUDED.url,
          is_available = EXCLUDED.is_available,
          last_checked_at = EXCLUDED.last_checked_at,
          updated_at = now()
      `,
        [
          gameId,
          StoreName.STEAM,
          storeProductId,
          snapshot.currentPrice,
          snapshot.regularPrice,
          snapshot.discountPercent,
          snapshot.currency,
          snapshot.url,
          snapshot.isAvailable,
          new Date(),
        ],
      );
    } catch (error) {
      throw this.translatePersistenceError(error, snapshot.appId);
    }

    const saved = await this.storeProducts.findOne({
      where: { storeName: StoreName.STEAM, storeProductId },
    });
    if (!saved) {
      throw new NotFoundException(
        `No se pudo leer la oferta de Steam para el appid ${snapshot.appId}`,
      );
    }
    return saved;
  }

  /**
   * Traduce un error de persistencia a un error de dominio estable.
   *
   * El mensaje crudo de Postgres (con nombres de tabla y de restriccion) no
   * sale del servidor: se registra en el log y el cliente recibe un mensaje
   * cerrado y predecible.
   */
  private translatePersistenceError(error: unknown, appId: number): Error {
    const detail = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string } | undefined)?.code;

    if (code === '23505') {
      this.logger.error(
        `Conflicto de unicidad al persistir el appid ${appId}: ${detail}`,
      );
      return new SteamStoreProductConflictError(
        `La oferta de Steam del appid ${appId} ya existe en el catalogo con otra vinculacion`,
      );
    }

    this.logger.error(
      `Fallo de persistencia al guardar el appid ${appId}: ${detail}`,
    );
    return new SteamStoreProductConflictError(
      `No se pudo persistir la oferta de Steam del appid ${appId}`,
    );
  }

  private toMajorUnits(cents: number): number {
    return Number((cents / CENTS).toFixed(2));
  }

  /**
   * Acota el descuento al rango que admite el CHECK de la base de datos
   * (0-100). Un `NaN` se trata como 0 (sin descuento).
   */
  private clampDiscountPercent(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(Math.max(value, 0), 100);
  }

  /**
   * Moneda del snapshot.
   *
   * Steam no publica `price_overview` en los juegos gratis o sin precio en la
   * region configurada. Fijar 'USD' a pelo persistia filas en la moneda
   * equivocada y mezclaba monedas en el historico: si la tienda no dice la
   * moneda, se deduce de la region configurada (`STEAM_COUNTRY_CODE`).
   */
  private resolveCurrency(published?: string): string {
    if (published) {
      return published.toUpperCase();
    }
    const map = this.config.steam.currencyByCountryCode;
    const countryCode = this.config.steam.countryCode.toLowerCase();
    return (map[countryCode] ?? 'USD').toUpperCase();
  }
}
