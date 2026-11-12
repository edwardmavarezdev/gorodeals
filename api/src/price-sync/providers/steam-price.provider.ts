import { DataSource } from 'typeorm';
import type { AppConfig } from '../../config.js';
import { createLogger } from '../../logger.js';
import { SteamService } from '../../steam/steam.service.js';
import { SteamAppNotFoundError } from '../../steam/steam.errors.js';
import { StoreName } from '../../store-products/entities/store-product.entity.js';
import { Page, StorePriceProvider, StorePriceResult } from '../sync.types.js';

/** Cursor inicial de la paginacion por clave (keyset) sobre `id`. */
const FIRST_CURSOR = '00000000-0000-0000-0000-000000000000';

/**
 * Proveedor de precios de Steam.
 *
 * El recorrido del catalogo se hace con paginacion por clave sobre `id`
 * (keyset), no con `OFFSET`: es estable frente a escrituras concurrentes y
 * no degrada con volumen. El cursor devuelto es opaco para el orquestador.
 *
 * Las consultas de precio usan el contrato `SteamService.getCurrentPrice`, que
 * ya encapsula reintentos, timeouts y cache del cliente de Steam. Aqui solo
 * se acota la concurrencia y el intervalo entre peticiones para no saturar la
 * API publica de la tienda.
 *
 * IMPORTANTE (contrato con el orquestador): el proveedor distingue entre
 * "Steam no publica datos para este appid" (resultado `unavailable`) y "la
 * API de Steam ha fallado" (resultado `error`). Solo el primero permite
 * marcar la oferta como no disponible. Un fallo tecnico deja la
 * disponibilidad intacta: con Steam caido, el catalogo entero no debe
 * aparecer como agotado.
 */
export class SteamPriceProvider implements StorePriceProvider {
  readonly storeName = StoreName.STEAM;

  private readonly logger = createLogger('SteamPriceProvider');
  private readonly concurrency: number;
  private readonly requestDelayMs: number;

  /**
   * Instante (ms) de la ultima peticion enviada a la tienda.
   *
   * Es un punto GLOBAL, no por worker: con 4 workers en paralelo, aplicar la
   * pausa en cada worker daria un intervalo real de la cuarta parte del
   * configurado. Un unico marcador compartido garantiza el intervalo
   * configurado entre peticiones consecutive, sea cual sea la concurrencia.
   */
  private lastRequestAt = 0;

  constructor(
    private readonly dataSource: DataSource,
    private readonly steamService: SteamService,
    private readonly config: AppConfig,
  ) {
    this.concurrency = this.config.steam.concurrency;
    this.requestDelayMs = this.config.priceSync.requestDelayMs;
  }

  /**
   * Devuelve el siguiente lote de identificadores de producto de Steam
   * (`store_product_id` = appid) ordenados por `id`.
   */
  async listStoreProductIds(
    batchSize: number,
    cursor?: string,
  ): Promise<Page<string>> {
    const rows = await this.dataSource.query<
      Array<{ id: string; store_product_id: string }>
    >(
      `
        SELECT id, store_product_id
        FROM store_products
        WHERE store_name = $1
          AND id > $2::uuid
        ORDER BY id ASC
        LIMIT $3
      `,
      [StoreName.STEAM, cursor ?? FIRST_CURSOR, batchSize],
    );

    const items = rows.map((row) => row.store_product_id);
    const last = rows[rows.length - 1];

    return {
      items,
      cursor: last ? last.id : undefined,
    };
  }

  /**
   * Consulta el precio actual de los productos indicados. Devuelve un
   * resultado por producto, en el mismo orden de entrada.
   */
  async fetchPrices(storeProductIds: string[]): Promise<StorePriceResult[]> {
    const results = new Array<StorePriceResult>(storeProductIds.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      for (;;) {
        const index = cursor++;
        if (index >= storeProductIds.length) {
          return;
        }
        const storeProductId = storeProductIds[index];
        results[index] = await this.fetchOne(storeProductId);
      }
    };

    const workers = Array.from(
      {
        length: Math.max(1, Math.min(this.concurrency, storeProductIds.length)),
      },
      () => worker(),
    );
    await Promise.all(workers);
    return results;
  }

  /**
   * Consulta el precio de un appid y clasifica el resultado.
   *
   * - `null` devuelto por el servicio: Steam no publica datos (appid
   *   inexistente o sin precio en la region) -> `unavailable`.
   * - `SteamAppNotFoundError`: idem, "sin datos" -> `unavailable`.
   * - Cualquier otro error (5xx, 403 por abuso, timeout, sin red): fallo
   *   TECNICO -> `error`. La disponibilidad no se toca.
   */
  private async fetchOne(storeProductId: string): Promise<StorePriceResult> {
    // La plaza se reserva ANTES de la peticion: es lo que espacia de verdad
    // las peticiones concurrentes entre si.
    await this.waitForSlot();
    try {
      const snapshot = await this.steamService.getCurrentPrice({
        storeName: StoreName.STEAM,
        storeProductId,
      });
      if (!snapshot) {
        this.logger.warn(
          `Steam no publica datos para el appid ${storeProductId}`,
        );
        return { storeProductId, status: 'unavailable' };
      }
      return {
        storeProductId,
        status: 'ok',
        snapshot: {
          storeProductId,
          currentPrice: snapshot.currentPrice.toFixed(2),
          regularPrice: snapshot.regularPrice.toFixed(2),
          discountPercent: snapshot.discountPercent.toFixed(2),
          currency: snapshot.currency,
          url: snapshot.url,
          isAvailable: snapshot.isAvailable,
        },
      };
    } catch (error) {
      if (error instanceof SteamAppNotFoundError) {
        this.logger.warn(
          `Steam no publica datos para el appid ${storeProductId}`,
        );
        return { storeProductId, status: 'unavailable' };
      }
      const message =
        error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(
        `Fallo tecnico consultando el appid ${storeProductId}: ${message}`,
      );
      return {
        storeProductId,
        status: 'error',
        error: error instanceof Error ? error : new Error(message),
      };
    }
  }

  /**
   * Espera hasta que se cumple el intervalo global entre peticiones.
   * El marcador se actualiza de forma atomica dentro del mismo tick, de modo
   * que varios workers en paralelo se turnan el intervalo configurado.
   */
  private async waitForSlot(): Promise<void> {
    if (this.requestDelayMs <= 0) {
      this.lastRequestAt = Date.now();
      return;
    }

    const now = Date.now();
    const wait = this.lastRequestAt + this.requestDelayMs - now;
    this.lastRequestAt = now + Math.max(0, wait);
    if (wait > 0) {
      await this.delay(wait);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
