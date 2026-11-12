import type { Static } from '@sinclair/typebox';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { IgdbService } from '../igdb/igdb.service.js';
import { StoreName } from '../store-products/entities/store-product.entity.js';
import {
  PriceHistoryService,
  StoreProductState,
} from './history/price-history.service.js';
import { SteamPriceProvider } from './providers/steam-price.provider.js';
import {
  StorePriceProvider,
  StorePriceSnapshot,
  StoreSyncResult,
} from './sync.types.js';
import {
  PriceSyncCatalogResult as PriceSyncCatalogResultSchema,
  PriceSyncRunResult as PriceSyncRunResultSchema,
  PriceSyncStatus as PriceSyncStatusSchema,
} from '../schemas/price-sync.js';

/** Identificador logico del lock de sync en la tabla `price_sync_locks`. */
const LOCK_ID = 'price_sync';

/** Paginas de IGDB por peticion (limite maximo admitido por la API). */
const IGDB_PAGE_SIZE = 50;

/** Opciones de una ejecucion del sync. */
export interface PriceSyncRunOptions {
  /** Tiendas a sincronizar. Por defecto, las configuradas en el entorno. */
  storeNames?: StoreName[];
  /** Tamano de lote al recorrer el catalogo. */
  batchSize?: number;
  /** Numero de paginas de catalogo de IGDB a sincronizar antes de auditar. */
  catalogPages?: number;
  /** Limite de productos a procesar (para ejecuciones manuales acotadas). */
  maxProducts?: number;
}

/**
 * Resumen de la fase de catalogo de IGDB.
 *
 * El tipo sale del esquema TypeBox (`src/schemas/price-sync.ts`), que es el
 * mismo que declara la respuesta de la API: asi no puede divergir el
 * contrato del servicio del contrato publicado.
 */
export type CatalogSyncResult = Static<typeof PriceSyncCatalogResultSchema>;

/**
 * Resultado global de una ejecucion del sync.
 *
 * Derivado del esquema TypeBox de la respuesta, igual que
 * `CatalogSyncResult`.
 */
export type PriceSyncRunResult = Static<typeof PriceSyncRunResultSchema>;

/** Estado del modulo: configuracion efectiva y ultima ejecucion. */
export type PriceSyncStatus = Static<typeof PriceSyncStatusSchema>;

/**
 * Orquestador del sync de precios.
 *
 * Responsabilidades:
 * - Recorrer el catalogo de ofertas de forma PAGINADA (nunca el catalogo
 *   completo en memoria).
 * - Delegar la obtencion de precios en los proveedores de tienda, que
 *   encapsulan el throttling y los reintentos de cada API.
 * - Persistir el estado actual y el historico de variaciones.
 * - Aislar los fallos: un error en una tienda o en un producto no aborta el
 *   ciclo completo.
 *
 * Idempotencia: el historico se escribe con `recorded_at` truncado al dia
 * (UTC) y `ON CONFLICT DO NOTHING` sobre (store_product_id, recorded_at), de
 * modo que reejecutar el sync el mismo dia no duplica filas.
 */
export class PriceSyncService {
  private readonly logger = createLogger('PriceSyncService');

  /** Guarda en memoria: evita solapamientos dentro de la misma instancia. */
  private running = false;
  /** Propietario del lock de BD del ciclo en curso (para el heartbeat). */
  private lockOwner: string | null = null;
  /** Ultimo instante en que se refresco el lock (throttle del heartbeat). */
  private lastLockRefreshAt: number | null = null;
  private runId: string | null = null;
  private lastResult: PriceSyncRunResult | null = null;

  private readonly providers = new Map<StoreName, StorePriceProvider>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: AppConfig,
    private readonly historyService: PriceHistoryService,
    private readonly steamProvider: SteamPriceProvider,
    private readonly igdbService: IgdbService,
  ) {
    this.providers.set(StoreName.STEAM, this.steamProvider);
  }

  /** Indica si hay una ejecucion en curso. */
  isRunning(): boolean {
    return this.running;
  }

  /** Resultado de la ultima ejecucion (en memoria). */
  getLastResult(): PriceSyncRunResult | null {
    return this.lastResult;
  }

  /**
   * Configuracion efectiva del modulo.
   *
   * El tipo de retorno es explicito (el esquema TypeBox del estado): si el
   * contrato cambia, el compilador lo detecta en vez de devolver `undefined`
   * en silencio.
   */
  getStatus(): PriceSyncStatus {
    return {
      cron: this.config.priceSync.cron,
      timezone: 'UTC',
      enabled: this.config.priceSync.enabled,
      batchSize: this.resolveBatchSize(),
      storeNames: this.resolveStoreNames(),
      running: this.running,
      lastRun: this.lastResult,
      catalogPages: this.resolveCatalogPages(),
      runId: this.runId,
    };
  }

  /**
   * Ejecuta un ciclo completo de sincronizacion.
   *
   * Si ya hay una ejecucion en curso (en esta instancia o en otra, mediante el
   * lock de base de datos) la llamada no hace nada y devuelve un resultado
   * marcado como omitido.
   */
  async runSync(
    options: PriceSyncRunOptions = {},
  ): Promise<PriceSyncRunResult> {
    const startedAt = new Date();
    const storeNames = options.storeNames ?? this.resolveStoreNames();
    const batchSize = Math.max(1, options.batchSize ?? this.resolveBatchSize());
    const catalogPages = Math.max(
      0,
      options.catalogPages ?? this.resolveCatalogPages(),
    );
    const maxProducts = options.maxProducts;

    if (this.running) {
      this.logger.warn('Sincronizacion omitida: ya hay un ciclo en curso');
      return this.buildSkippedResult(
        startedAt,
        'Ya existe una ejecucion de sincronizacion en curso',
      );
    }

    // La guarda se activa de forma sincrona (antes del primer `await`) para
    // que dos llamadas consecutivas no puedan solaparse.
    this.running = true;

    const lockOwner = randomUUID();
    const lock = await this.acquireLock(lockOwner);
    if (!lock.acquired) {
      this.running = false;
      if (lock.error) {
        this.logger.warn(
          `Sincronizacion omitida: fallo al tomar el lock del sync (${lock.error})`,
        );
        return this.buildSkippedResult(
          startedAt,
          `No se pudo tomar el lock de sincronizacion: ${lock.error}`,
        );
      }
      this.logger.warn(
        'Sincronizacion omitida: otra instancia mantiene el lock del sync',
      );
      return this.buildSkippedResult(
        startedAt,
        'Otra instancia esta ejecutando la sincronizacion',
      );
    }
    this.lockOwner = lockOwner;
    this.lastLockRefreshAt = Date.now();

    this.runId = randomUUID();
    const result: PriceSyncRunResult = {
      startedAt: startedAt.toISOString(),
      finishedAt: startedAt.toISOString(),
      durationMs: 0,
      skipped: false,
      skipReason: null,
      catalog: null,
      stores: [],
      totals: {
        processed: 0,
        updated: 0,
        changed: 0,
        unchanged: 0,
        historyInserted: 0,
        unavailable: 0,
        errors: 0,
      },
    };

    try {
      if (catalogPages > 0) {
        result.catalog = await this.syncCatalog(catalogPages);
      }

      for (const storeName of storeNames) {
        const storeResult = await this.syncStore(
          storeName,
          batchSize,
          maxProducts,
        );
        result.stores.push(storeResult);
        result.totals.processed += storeResult.processed;
        result.totals.updated += storeResult.updated;
        result.totals.changed += storeResult.changed;
        result.totals.unchanged += storeResult.unchanged;
        result.totals.historyInserted += storeResult.historyInserted;
        result.totals.unavailable += storeResult.unavailable;
        result.totals.errors += storeResult.errors;
      }
    } finally {
      await this.releaseLock(lockOwner);
      this.lockOwner = null;
      this.lastLockRefreshAt = null;
      this.running = false;
      this.runId = null;
      const finishedAt = new Date();
      result.finishedAt = finishedAt.toISOString();
      result.durationMs = finishedAt.getTime() - startedAt.getTime();
      this.lastResult = result;
      this.logger.log(
        `Sincronizacion finalizada en ${result.durationMs} ms: ` +
          `${result.totals.processed} procesados, ` +
          `${result.totals.changed} variaciones, ` +
          `${result.totals.historyInserted} filas de historico, ` +
          `${result.totals.errors} errores`,
      );
    }

    return result;
  }

  /**
   * Sincroniza el catalogo de IGDB paginando por limit/offset encadenados.
   * El cliente de IGDB ya limita el ritmo a 4 peticiones por segundo.
   */
  private async syncCatalog(pages: number): Promise<CatalogSyncResult> {
    const result: CatalogSyncResult = {
      pages: 0,
      fetched: 0,
      upserted: 0,
      skipped: 0,
      errors: 0,
    };

    if (!this.igdbService.isConfigured()) {
      this.logger.warn(
        'Sincronizacion de catalogo omitida: credenciales de IGDB no configuradas',
      );
      return result;
    }

    for (let page = 0; page < pages; page += 1) {
      try {
        const offset = page * IGDB_PAGE_SIZE;
        const summary = await this.igdbService.sync({
          limit: IGDB_PAGE_SIZE,
          offset,
        });
        result.pages += 1;
        result.fetched += summary.fetched;
        result.upserted += summary.upserted;
        result.skipped += summary.skipped;
      } catch (error) {
        result.errors += 1;
        const message =
          error instanceof Error ? error.message : 'error desconocido';
        this.logger.error(
          `Fallo al sincronizar la pagina ${page} del catalogo de IGDB: ${message}`,
        );
      }
    }

    return result;
  }

  /**
   * Audita los precios de una tienda recorriendo el catalogo por lotes.
   * Cada tienda se aísla: un fallo no aborta el ciclo.
   */
  private async syncStore(
    storeName: StoreName,
    batchSize: number,
    maxProducts?: number,
  ): Promise<StoreSyncResult> {
    const startedAt = Date.now();
    const result: StoreSyncResult = {
      storeName,
      processed: 0,
      updated: 0,
      changed: 0,
      unchanged: 0,
      unavailable: 0,
      historyInserted: 0,
      errors: 0,
      durationMs: 0,
    };

    const provider = this.providers.get(storeName);
    if (!provider) {
      this.logger.warn(
        `No hay proveedor de precios para la tienda ${storeName}`,
      );
      result.errors += 1;
      return result;
    }

    let cursor: string | undefined;
    // Productos INTENTADOS, no solo los persistidos con exito: el corte por
    // `maxProducts` debe contar tambien los que fallaron, o una ejecucion
    // acotada nunca se detendria.
    let attempted = 0;
    try {
      for (;;) {
        const page = await provider.listStoreProductIds(batchSize, cursor);
        if (page.items.length === 0) {
          break;
        }

        const remaining =
          maxProducts === undefined
            ? page.items.length
            : Math.max(0, maxProducts - attempted);
        const ids = page.items.slice(0, remaining);
        attempted += ids.length;

        if (ids.length > 0) {
          const batch = await this.processBatch(
            provider,
            storeName,
            ids,
            result,
          );
          if (batch.aborted) {
            break;
          }
        }

        // Heartbeat del lock: lo mantiene vigente durante todo el ciclo.
        if (!(await this.heartbeatLock())) {
          result.errors += 1;
          throw new Error(
            'Se perdio el lock de sincronizacion: se aborta el ciclo para no competir con otra instancia',
          );
        }

        cursor = page.cursor;
        if (maxProducts !== undefined && attempted >= maxProducts) {
          break;
        }
        if (page.items.length < batchSize) {
          break;
        }
      }
    } catch (error) {
      result.errors += 1;
      const message =
        error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(
        `Fallo la sincronizacion de la tienda ${storeName}: ${message}`,
      );
    }

    result.durationMs = Date.now() - startedAt;
    this.logger.log(
      `Tienda ${storeName}: ${result.processed} procesados, ` +
        `${result.changed} variaciones, ${result.historyInserted} altas de historico, ` +
        `${result.errors} errores en ${result.durationMs} ms`,
    );
    return result;
  }

  /**
   * Procesa un lote de productos de una tienda.
   *
   * La persistencia se hace en una sola transaccion por lote (no una por
   * producto): medido 0,44 ms/producto frente a 2,30 ms por producto. Si la
   * transaccion del lote falla, se reintenta producto a producto para que un
   * unico registro problematico no tire el lote entero.
   *
   * Distingue los tres resultados del proveedor:
   * - `ok`: se persiste el precio.
   * - `unavailable`: Steam no publica datos -> se marca la oferta como no
   *   disponible (y solo ella).
   * - `error`: fallo tecnico -> se cuenta como error y NO se toca la
   *   disponibilidad. Con Steam caido, el catalogo entero quedaria marcado
   *   como no disponible sin dejar rastro en el historico.
   *
   * Si el porcentaje de fallos tecnicos del lote supera el umbral
   * configurado (`PRICE_SYNC_MAX_FAILURE_RATE`), se aborta el ciclo de la
   * tienda: es una senal de que la tienda no esta operativa.
   */
  private async processBatch(
    provider: StorePriceProvider,
    storeName: StoreName,
    ids: string[],
    result: StoreSyncResult,
  ): Promise<{ aborted: boolean }> {
    const outcomes = await provider.fetchPrices(ids);
    const outcomeById = new Map(
      outcomes.map((outcome) => [outcome.storeProductId, outcome]),
    );
    const states = await this.historyService.findStoreProductStates(
      storeName,
      ids,
    );

    const items: Array<{
      state: StoreProductState;
      snapshot: StorePriceSnapshot;
    }> = [];

    let technicalFailures = 0;

    for (const id of ids) {
      const state = states.get(id);
      if (!state) {
        result.errors += 1;
        this.logger.warn(`No existe la oferta ${id} en ${storeName}: se omite`);
        continue;
      }

      const outcome = outcomeById.get(id);
      if (!outcome) {
        // El proveedor no devolvio resultado para este producto: se trata
        // como fallo tecnico, no como "sin datos".
        technicalFailures += 1;
        result.errors += 1;
        this.logger.error(
          `El proveedor de ${storeName} no devolvio resultado para la oferta ${id}`,
        );
        continue;
      }

      if (outcome.status === 'error') {
        technicalFailures += 1;
        result.errors += 1;
        this.logger.error(
          `Fallo tecnico al obtener el precio de la oferta ${id}: ${outcome.error.message}`,
        );
        continue;
      }

      if (outcome.status === 'unavailable') {
        result.unavailable += 1;
        try {
          await this.historyService.markUnavailable(state);
        } catch (error) {
          result.errors += 1;
          this.logger.error(
            `No se pudo marcar como no disponible la oferta ${id}: ${this.describe(error)}`,
          );
        }
        continue;
      }

      items.push({ state, snapshot: outcome.snapshot });
    }

    const aborted = this.exceedsFailureRate(technicalFailures, ids.length);
    if (aborted) {
      this.logger.error(
        `Tienda ${storeName}: ${technicalFailures}/${ids.length} fallos tecnicos ` +
          `superan el umbral ${this.resolveMaxFailureRate()}; se aborta el ciclo de la tienda`,
      );
      return { aborted: true };
    }

    if (items.length === 0) {
      return { aborted: false };
    }

    let persisted: Map<string, { changed: boolean; historyInserted: boolean }>;
    try {
      persisted = await this.historyService.persistBatch(items);
    } catch (error) {
      this.logger.error(
        `Fallo al persistir el lote de ${items.length} ofertas de ${storeName}: ${this.describe(error)}. ` +
          'Se reintenta producto a producto',
      );
      persisted = await this.persistIndividually(items);
    }

    for (const { state } of items) {
      const outcome = persisted.get(state.storeProductId);
      if (!outcome) {
        result.errors += 1;
        this.logger.error(
          `No se pudo persistir el precio de la oferta ${state.storeProductId}`,
        );
        continue;
      }
      result.processed += 1;
      result.updated += 1;
      if (outcome.changed) {
        result.changed += 1;
      } else {
        result.unchanged += 1;
      }
      if (outcome.historyInserted) {
        result.historyInserted += 1;
      }
    }

    return { aborted: false };
  }

  /**
   * Indica si el porcentaje de fallos tecnicos de un lote supera el umbral
   * configurado (`PRICE_SYNC_MAX_FAILURE_RATE`, 0,5 por defecto).
   */
  private exceedsFailureRate(failures: number, total: number): boolean {
    if (total === 0 || failures === 0) {
      return false;
    }
    return failures / total > this.resolveMaxFailureRate();
  }

  /** Umbral de fallos tecnicos que aborta el ciclo de una tienda. */
  private resolveMaxFailureRate(): number {
    const value = this.config.priceSync.maxFailureRate;
    return Math.min(Math.max(value, 0), 1);
  }

  /**
   * Reintento producto a producto cuando la transaccion del lote falla.
   * Aísla el producto problematico y conserva el resto del lote.
   */
  private async persistIndividually(
    items: Array<{ state: StoreProductState; snapshot: StorePriceSnapshot }>,
  ): Promise<Map<string, { changed: boolean; historyInserted: boolean }>> {
    const persisted = new Map<
      string,
      { changed: boolean; historyInserted: boolean }
    >();

    for (const { state, snapshot } of items) {
      try {
        const outcome = await this.historyService.persistSnapshot(
          state,
          snapshot,
        );
        persisted.set(state.storeProductId, outcome);
      } catch (error) {
        // El error se contabiliza en el recorrido final, donde el producto
        // sin resultado se cuenta como error.
        this.logger.error(
          `Fallo al persistir el precio de la oferta ${state.storeProductId}: ${this.describe(error)}`,
        );
      }
    }

    return persisted;
  }

  /**
   * Intenta tomar el lock de sincronizacion. Devuelve `false` si otra
   * instancia lo mantiene. El lock se libera solo si `locked_at` es mas viejo
   * que el timeout configurado (por si una instancia muere abruptamente).
   *
   * Si la consulta al lock falla, el ciclo se ABORTA: seguir sin lock
   * permitiria que dos instancias escribieran el historico a la vez.
   */
  private async acquireLock(
    owner: string,
  ): Promise<{ acquired: boolean; error: string | null }> {
    const timeoutSeconds = this.config.priceSync.lockTimeoutSeconds;
    try {
      const rows = await this.dataSource.query<Array<{ id: string }>>(
        `
          INSERT INTO price_sync_locks (id, locked_at, locked_by)
          VALUES ($1, now(), $2)
          ON CONFLICT (id) DO UPDATE
            SET locked_at = now(),
                locked_by = $2
            WHERE price_sync_locks.locked_at
                  < now() - make_interval(secs => $3::double precision)
          RETURNING id
        `,
        [LOCK_ID, owner, timeoutSeconds],
      );
      return { acquired: rows.length > 0, error: null };
    } catch (error) {
      const message = this.describe(error);
      this.logger.error(
        `No se pudo tomar el lock de sincronizacion (${message}); ` +
          'se aborta el ciclo para no escribir el historico sin exclusion',
      );
      return { acquired: false, error: message };
    }
  }

  /**
   * Renueva el `locked_at` del lock mientras el ciclo sigue vivo.
   *
   * El timeout por defecto (3600 s) puede quedarse corto para un catalogo
   * grande: sin refresco, otra instancia podria considerar el lock obsoleto y
   * arrancar un sync en paralelo. El heartbeat mantiene el lock vigente
   * durante todo el trabajo.
   *
   * @returns `true` si el lock sigue siendo nuestro.
   */
  private async refreshLock(owner: string): Promise<boolean> {
    try {
      const rows = await this.dataSource.query<Array<{ id: string }>>(
        `
          UPDATE price_sync_locks
          SET locked_at = now()
          WHERE id = $1 AND locked_by = $2
          RETURNING id
        `,
        [LOCK_ID, owner],
      );
      return rows.length > 0;
    } catch (error) {
      this.logger.error(
        `No se pudo refrescar el lock de sincronizacion: ${this.describe(error)}`,
      );
      return false;
    }
  }

  /**
   * Refresca el lock como mucho una vez por cada tercio del timeout
   * configurado. Asi el lock sigue vigente aunque el ciclo tarde mas que
   * `PRICE_SYNC_LOCK_TIMEOUT_SECONDS` (3600 s por defecto).
   *
   * @returns `false` si el lock se ha perdido (otra instancia lo ha tomado).
   */
  private async heartbeatLock(): Promise<boolean> {
    if (!this.lockOwner) {
      return true;
    }

    const now = Date.now();
    const timeoutMs = this.config.priceSync.lockTimeoutSeconds * 1000;
    const intervalMs = Math.max(30_000, Math.floor(timeoutMs / 3));

    if (
      this.lastLockRefreshAt !== null &&
      now - this.lastLockRefreshAt < intervalMs
    ) {
      return true;
    }

    const refreshed = await this.refreshLock(this.lockOwner);
    this.lastLockRefreshAt = now;
    return refreshed;
  }

  /** Libera el lock de sincronizacion. */
  private async releaseLock(owner: string): Promise<void> {
    try {
      await this.dataSource.query(
        `DELETE FROM price_sync_locks WHERE id = $1 AND locked_by = $2`,
        [LOCK_ID, owner],
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo liberar el lock de sincronizacion: ${this.describe(error)}`,
      );
    }
  }

  private resolveStoreNames(): StoreName[] {
    const raw = this.config.priceSync.storeNames;
    const names = raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
      .filter((value): value is StoreName =>
        Object.values(StoreName).includes(value as StoreName),
      );
    return names.length > 0 ? names : [StoreName.STEAM];
  }

  private resolveBatchSize(): number {
    const value = this.config.priceSync.batchSize;
    return Math.max(1, value);
  }

  private resolveCatalogPages(): number {
    const value = this.config.priceSync.catalogPages;
    return Math.max(0, value);
  }

  private buildSkippedResult(
    startedAt: Date,
    reason: string,
  ): PriceSyncRunResult {
    return {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      skipped: true,
      skipReason: reason,
      catalog: null,
      stores: [],
      totals: {
        processed: 0,
        updated: 0,
        changed: 0,
        unchanged: 0,
        historyInserted: 0,
        unavailable: 0,
        errors: 0,
      },
    };
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : 'error desconocido';
  }

  /**
   * Libera el lock de sincronizacion al apagar el proceso.
   *
   * `releaseLock` es idempotente (borra solo la fila cuyo `locked_by` es
   * nuestro), asi que se puede llamar sin miedo aunque el ciclo ya haya
   * terminado. Sin esto, tras un reinicio ninguna instancia podria
   * sincronizar hasta que el lock caducase (una hora por defecto).
   *
   * En NestJS esto era `onModuleDestroy()`, invocado por el contenedor de
   * inyeccion al cerrar el modulo. Fastify NO invoca este metodo por su
   * cuenta: lo llama el hook `onClose` del planificador
   * (`src/plugins/scheduler.ts`), que corre antes de cerrar la base de
   * datos.
   */
  async onDestroy(): Promise<void> {
    if (this.lockOwner) {
      this.logger.warn(
        'El proceso se cierra con una sincronizacion en curso: se libera el lock',
      );
      await this.releaseLock(this.lockOwner);
      this.lockOwner = null;
      this.lastLockRefreshAt = null;
      this.running = false;
    }
  }
}
